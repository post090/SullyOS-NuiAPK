import { describe, expect, it } from 'vitest';
import { editLibrary, novelReadingMode, readableNovels } from './library';
import { pickNovel, rollRoom } from './runSession';
import { withLatestVRParticipation } from './participation';
import type { CharacterProfile, VRWorldNovel } from '../../types';

const book = (id:string,categoryId?:string):VRWorldNovel => ({id,title:id,categoryId,segments:[{idx:0,text:'正文',chars:2}],totalChars:2,createdAt:1,updatedAt:1});
const char = (state:Record<string,unknown> = {}):CharacterProfile => ({vrState:{enabled:true,intervalMinutes:120,novelReadingMode:'categories',preferredNovelCategoryIds:['web'],...state}} as CharacterProfile);
const categories = [{id:'web',name:'网文'},{id:'lit',name:'严肃文学'}];

describe('分类阅读边界',()=>{
    it('旧档自动轮换与逐本偏好保持原模式',()=>{
        expect(novelReadingMode({})).toBe('all');
        expect(novelReadingMode(char({novelReadingMode:undefined,preferredNovelIds:['a']}))).toBe('books');
    });
    it('只读选中分类，忽略旧逐本偏好且避免连续同一本',()=>{
        const books=[book('a','web'),book('b','web'),book('c','lit'),book('d')];
        const c=char({preferredNovelIds:['c'],lastNovelId:'a'});
        expect(pickNovel(books,c,()=>0.99)?.id).toBe('b');
        expect(readableNovels(books,c).map(n=>n.id)).toEqual(['a','b']);
    });
    it('分类读完后在本分类重读，不去别的分类批注',()=>{
        expect(pickNovel([book('a','web'),book('b','lit')],char({novelBookmarks:{a:1}}),()=>0.99)?.id).toBe('a');
    });
    it('空分类和失效分类不回退全书库，自动活动避开图书馆',()=>{
        const books=[book('b','lit')];
        for(const ids of [[],['gone'],['web']]){
            const c=char({preferredNovelCategoryIds:ids});
            expect(pickNovel(books,c)).toBeNull();
            expect(rollRoom(c,books,null,'library')).toBeNull();
            expect(rollRoom(c,books,null,undefined,()=>0.99)).not.toBe('library');
        }
    });
    it('新书归入分类后自动进入候选池，多分类使用并集',()=>{
        const c=char({preferredNovelCategoryIds:['web','lit']});
        expect(readableNovels([book('new','web'),book('other','lit'),book('outside')],c).map(n=>n.id)).toEqual(['new','other']);
    });
    it('活动保存保留生成期间刚修改的阅读范围',()=>{
        const latest=char({preferredNovelCategoryIds:['lit']});
        const merged=withLatestVRParticipation(latest,{vrState:{...char().vrState!,lastNovelId:'a'}});
        expect(merged.vrState?.preferredNovelCategoryIds).toEqual(['lit']);
        expect(merged.vrState?.lastNovelId).toBe('a');
    });
});

describe('整理书库',()=>{
    it('分类重命名保持 ID；不会重写正文与批注',()=>{
        const result=editLibrary(categories,[book('a','web')],{kind:'rename',id:'web',name:' 网络小说 '});
        expect(result.categories[0]).toEqual({id:'web',name:'网络小说'});
        expect(result.changed).toEqual([]);
    });
    it('批量移动只更新选中书的分类，并保留书签使用的 ID',()=>{
        const a=book('a'),b=book('b');
        expect(editLibrary(categories,[a,b],{kind:'assign',novelIds:['a'],categoryId:'web'}).changed).toEqual([{...a,categoryId:'web'}]);
        expect(a.categoryId).toBeUndefined();
    });
    it('移除分类只把书移回未分类，原文与创建时间保留',()=>{
        const a=book('a','web');
        const result=editLibrary(categories,[a,book('b','lit')],{kind:'remove',id:'web'});
        expect(result.changed).toEqual([{...a,categoryId:undefined}]);
        expect(result.categories).toEqual([categories[1]]);
    });
    it('拒绝空名称、重复名称、过期分类操作',()=>{
        expect(()=>editLibrary(categories,[],{kind:'create',id:'new',name:' '})).toThrow();
        expect(()=>editLibrary(categories,[],{kind:'create',id:'new',name:' 网文 '})).toThrow();
        expect(()=>editLibrary(categories,[],{kind:'assign',novelIds:['a'],categoryId:'gone'})).toThrow();
        expect(()=>editLibrary(categories,[],{kind:'rename',id:'gone',name:'name'})).toThrow();
    });
});
