import type {CustomCreatorPart} from '../types';

// Back to front, preserving the shared 472px artwork registration.
export const sullyHairParts: CustomCreatorPart[] = [
 ['back2', '后发 2'], ['back1', '后发 1'], ['earhair', '耳发'], ['fronthair', '刘海'],
].map(([key, name]) => ({
 id: `${key}_99`, categoryKey: key, name: `Sully ${name}`,
 src: `${import.meta.env.BASE_URL}like520/sully/${key}.png`, tintable: true, createdAt: 0,
}));
