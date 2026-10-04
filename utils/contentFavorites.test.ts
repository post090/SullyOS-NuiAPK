import { beforeEach, describe, expect, it } from 'vitest';
import type { GalleryImage, Message } from '../types';
import { DB, openDB } from './db';
import JSZip from 'jszip';
import { writeV2Backup, assembleV2Backup } from './backupFormat';
import { stripBackupImages } from './backupExport';
import { collectBlobRefs, writeBlobsToZip, readBlobsIndex, restoreBlobsFromZip } from './backupBlobs';
import { getBlobForRef, deleteBlobRef, restoreBlobRef } from './blobRef';
import {
    CONTENT_FAVORITES_INDEX_ASSET_ID,
    contentFavoriteIdForMessage,
    favoriteImageAssetId,
    listContentFavorites,
    removeContentFavoriteById,
    resolveContentFavorite,
    saveGalleryImageContentFavorite,
    saveMessageContentFavorite,
    saveConversationContentFavorite,
} from './contentFavorites';

const CHAR_ID = 'content-favorite-test-char';

const message = (overrides: Partial<Message> = {}): Message => ({
    id: 701,
    charId: CHAR_ID,
    role: 'assistant',
    type: 'text',
    content: '只存在于原消息里的正文',
    timestamp: 100,
    ...overrides,
});

beforeEach(async () => {
    await DB.deleteAsset(CONTENT_FAVORITES_INDEX_ASSET_ID).catch(() => undefined);
    await DB.clearMessages(CHAR_ID).catch(() => undefined);
    const images = await DB.getGalleryImages(CHAR_ID).catch(() => []);
    await Promise.all(images.map(image => DB.deleteGalleryImage(image.id)));
});

describe('content favorites reference index', () => {
    it.each(['full', 'text_only'])('keeps a selected conversation after source deletion and %s ZIP restoration', async mode => {
        const user = message({ id: 901, role: 'user', content: '值得纪念的约定' });
        const reply = message({ id: 902, content: '我会记得', timestamp: 101 });
        const picture = message({ id: 903, type: 'image', content: 'data:image/png;base64,QUJDREVGRw==', timestamp: 102 });
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('messages', 'readwrite');
            [user, reply, picture].forEach(row => tx.objectStore('messages').put(row));
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        });
        const selected = [picture, reply, user, user, message({ id: 904, charId: 'another', content: '不可串进收藏' })];
        const saved = await saveConversationContentFavorite(selected, CHAR_ID, 'Sully', '小明');
        await saveConversationContentFavorite(selected, CHAR_ID, 'Sully', '小明');
        expect(await listContentFavorites()).toHaveLength(1);
        expect(saved.conversation?.map(entry => entry.messageId)).toEqual([901, 902, 903]);
        expect(saved.conversation?.map(entry => entry.senderName)).toEqual(['小明', 'Sully', 'Sully']);
        expect(saved.snapshot?.content).toContain('我会记得');
        expect(saved.snapshot?.content).not.toContain('不可串进收藏');
        const imageRef = saved.conversation![2].content;
        expect(imageRef).toMatch(/^blobref:/);
        await DB.clearMessages(CHAR_ID);
        expect(await DB.getMessageById(user.id)).toBeFalsy();
        const data = mode === 'full' ? await DB.exportFullData() : {
            contentFavoritesIndex: stripBackupImages(await DB.getAssetRaw(CONTENT_FAVORITES_INDEX_ASSET_ID)),
        };
        const zip = new JSZip();
        const refs = new Set<string>();
        await writeV2Backup(zip, data as any, { onSerialized: json => collectBlobRefs(json, refs) });
        if (mode === 'full') await writeBlobsToZip(zip, refs, getBlobForRef);
        const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
        await DB.deleteAsset(CONTENT_FAVORITES_INDEX_ASSET_ID);
        await deleteBlobRef(imageRef);
        await DB.saveAssetRaw('unrelated-asset', { keep: true });
        await DB.importFullData(await assembleV2Backup(loaded, JSON.parse(await loaded.file('manifest.json')!.async('string'))) as any);
        if (mode === 'full') await restoreBlobsFromZip(loaded, await readBlobsIndex(loaded), restoreBlobRef);
        const restored = (await listContentFavorites())[0];
        expect(restored.kind).toBe('chat');
        if (restored.kind !== 'chat') throw new Error('wrong kind');
        expect(restored.conversation?.slice(0, 2)).toEqual(saved.conversation?.slice(0, 2));
        const resolved = await resolveContentFavorite(restored);
        expect('message' in resolved && resolved.message?.content).toContain('值得纪念的约定');
        if (mode === 'full') expect(await getBlobForRef(restored.conversation![2].content)).not.toBeNull();
        else {
            expect(restored.conversation![2].content).toBe('');
            expect(await DB.getAssetRaw('unrelated-asset')).toEqual({ keep: true });
        }
        await removeContentFavoriteById(restored.id);
        expect(await listContentFavorites()).toEqual([]);
    });
    it('keeps a lightweight chat snapshot readable after the original is deleted', async () => {
        const sourceId = await DB.saveMessage({
            charId: CHAR_ID,
            role: 'assistant',
            type: 'text',
            content: '只存在于原消息里的正文',
        });
        const source = message({ id: sourceId });
        await saveMessageContentFavorite(source, 'Sully');

        const items = await listContentFavorites();
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            kind: 'chat',
            messageId: source.id,
            charId: CHAR_ID,
        });
        expect(items[0].kind === 'chat' && items[0].snapshot?.content).toBe(source.content);

        await DB.deleteMessage(source.id);
        const resolved = await resolveContentFavorite((await listContentFavorites())[0]);
        expect('message' in resolved && resolved.message?.content).toBe(source.content);
        expect('sourceAvailable' in resolved && resolved.sourceAvailable).toBe(false);
    });

    it('deduplicates the same image across chat and gallery without storing media', async () => {
        const url = 'data:image/png;base64,QUJDREVGRw==';
        const sourceMessageId = await DB.saveMessage({
            charId: CHAR_ID,
            role: 'assistant',
            type: 'image',
            content: url,
        });
        const sourceMessage = message({ id: sourceMessageId, type: 'image', content: url });
        const galleryImage: GalleryImage = {
            id: 'favorite-gallery-702',
            charId: CHAR_ID,
            url,
            timestamp: 101,
        };

        await DB.saveGalleryImage(galleryImage);
        await saveMessageContentFavorite(sourceMessage, 'Sully');
        const linkedFromChat = (await listContentFavorites())[0];
        expect(linkedFromChat.kind === 'image' ? linkedFromChat.references : []).toHaveLength(2);
        await saveGalleryImageContentFavorite(galleryImage, 'Sully');

        const items = await listContentFavorites();
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ kind: 'image', id: contentFavoriteIdForMessage(sourceMessage) });
        expect(items[0].kind === 'image' && items[0].references).toHaveLength(2);
        const retainedAssetId = favoriteImageAssetId(items[0].kind === 'image' ? items[0].fingerprint : '');
        const rawIndex = JSON.stringify(await DB.getAssetRaw(CONTENT_FAVORITES_INDEX_ASSET_ID));
        expect(rawIndex).not.toContain(url);
        expect(rawIndex).not.toContain('base64');
        expect(await DB.getAssetRaw(retainedAssetId)).toBeNull();

        await DB.deleteMessage(sourceMessage.id);
        expect(await DB.getAssetRaw(retainedAssetId)).toBeNull();
        await DB.deleteGalleryImage(galleryImage.id);

        const retained = (await listContentFavorites())[0];
        const resolved = await resolveContentFavorite(retained);
        expect(resolved.favorite.kind).toBe('image');
        expect('imageUrl' in resolved && resolved.imageUrl).toBe(url);
        expect('reference' in resolved && resolved.reference?.source).toBe('favorite_asset');
        expect(await DB.getAssetRaw(retainedAssetId)).toMatchObject({ imageUrl: url });

        // If the same live image returns later, ownership moves back to that source and
        // the temporary favorite-owned media row is removed instead of duplicating it.
        await DB.saveGalleryImage(galleryImage);
        await saveGalleryImageContentFavorite(galleryImage, 'Sully');
        expect(await DB.getAssetRaw(retainedAssetId)).toBeNull();
        await DB.deleteGalleryImage(galleryImage.id);
        expect(await DB.getAssetRaw(retainedAssetId)).toMatchObject({ imageUrl: url });

        await removeContentFavoriteById(retained.id);
        expect(await DB.getAssetRaw(retainedAssetId)).toBeNull();
    });
});
