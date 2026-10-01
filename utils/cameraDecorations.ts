const base = `${import.meta.env.BASE_URL}assets/camera/`;
export const CAMERA_DECORATIONS = [
    { id: 'red_heart', name: '爱心', group: '立体', file: 'fluent/red_heart.png' },
    { id: 'sparkles', name: '闪亮', group: '立体', file: 'fluent/sparkles.png' },
    { id: 'cherry_blossom', name: '樱花', group: '立体', file: 'fluent/cherry_blossom.png' },
    { id: 'ribbon', name: '蝴蝶结', group: '立体', file: 'fluent/ribbon.png' },
    { id: 'star', name: '星星', group: '立体', file: 'fluent/star.png' },
    { id: 'cloud', name: '云朵', group: '立体', file: 'fluent/cloud.png' },
    { id: 'strawberry', name: '草莓', group: '立体', file: 'fluent/strawberry.png' },
    { id: 'love_letter', name: '情书', group: '立体', file: 'fluent/love_letter.png' },
    { id: 'star_04', name: '柔光星芒', group: '光效', file: 'kenney/star_04.png' },
    { id: 'star_06', name: '璀璨星芒', group: '光效', file: 'kenney/star_06.png' },
    { id: 'light_01', name: '柔光光斑', group: '光效', file: 'kenney/light_01.png' },
].map(item => ({ ...item, image: base + item.file }));
