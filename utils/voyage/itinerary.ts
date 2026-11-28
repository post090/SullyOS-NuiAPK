import { readStopPhotos, stopPhotosSchema, type StopPhotos } from './photos';

export const MAX_VOYAGE_SOURCES = 32;
const localClock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const maxStops = 48;
const textFields = {
    place: [160, '具体地点或路段'],
    route: [1200, '从上一站或出发点怎么到，交通方式、转场时间、开放与预约条件。未核实处说明。'],
    cost: [800, '当地币种、每人预计价格及包含项目。能核实免费才写免费，未查到写待核实。'],
    weatherPlan: [900, '本站受天气影响的条件、何时改走哪条备选；日期未定时使用条件句。'],
    placeNotes: [1800, '有来源的具体景物、建筑、地方故事或文化背景。写出在这里值得留意的细节。'],
    scene: [1400, '抵达时可以观察或聆听什么。将随天气、时段而变的内容写成可能或条件，不代写角色的行动、情绪。'],
} as const;

export interface VoyageStop {
    day: number;
    startLocal: string;
    durationMinutes: number;
    place: string;
    route: string;
    cost: string;
    weatherPlan: string;
    placeNotes: string;
    scene: string;
    choices: string[];
    sourceNumbers: number[];
    visuals?: StopPhotos;
}
export interface VoyageItinerary { timeZone: string; stops: VoyageStop[] }

export const itinerarySchema = {
    type: 'object', additionalProperties: false, required: ['timeZone', 'stops'],
    properties: {
        timeZone: { type: 'string', description: '目的地 IANA 时区，例如 Asia/Shanghai' },
        stops: { type: 'array', minItems: 1, maxItems: maxStops, items: {
            type: 'object', additionalProperties: false,
            required: ['day', 'startLocal', 'durationMinutes', ...Object.keys(textFields), 'choices', 'sourceNumbers', 'visuals'],
            properties: {
                visuals: stopPhotosSchema,
                day: { type: 'integer', minimum: 1, description: '旅程第几天，从 1 开始' },
                startLocal: { type: 'string', pattern: localClock.source, description: '建议抵达的当地时间 HH:mm' },
                durationMinutes: { type: 'integer', minimum: 1, maximum: 2880, description: '预计停留分钟，可调整' },
                ...Object.fromEntries(Object.entries(textFields).map(([key, [maxLength, description]]) =>
                    [key, { type: 'string', minLength: 1, maxLength, description }])),
                choices: { type: 'array', minItems: 2, maxItems: 6, uniqueItems: true, items: { type: 'string', maxLength: 480 },
                    description: '至少两个真实可选方向，与地点和角色相关，可停留、改变主意或休息' },
                sourceNumbers: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'integer', minimum: 1 },
                    description: '支撑本站事实的来源序号，对应草稿 sources，第一个是 1' },
            },
        } },
    },
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
function readText(value: unknown, limit: number, label: string) {
    if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new Error('请补全或缩短' + label);
    return value.trim();
}
function readStop(input: unknown, sourceCount: number): VoyageStop {
    if (!record(input) || !integer(input.day) || input.day < 1 || typeof input.startLocal !== 'string' || !localClock.test(input.startLocal)
        || !integer(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 2880) throw new Error('分站资料需要有效的天数、当地时间与停留时长');
    if (!Array.isArray(input.choices) || input.choices.length < 2 || input.choices.length > 6) throw new Error('每站需要两至六个可选行动');
    const choices = input.choices.map((choice: unknown) => readText(choice, 480, '可选行动'));
    if (new Set(choices).size !== choices.length) throw new Error('请给出不同的可选行动');
    if (!Array.isArray(input.sourceNumbers) || !input.sourceNumbers.length || input.sourceNumbers.length > sourceCount
        || !input.sourceNumbers.every((n: unknown): n is number => integer(n) && n >= 1 && n <= sourceCount)
        || new Set(input.sourceNumbers).size !== input.sourceNumbers.length) throw new Error('请关联本站实际使用的来源序号');
    const field = (key: keyof typeof textFields) => readText(input[key], textFields[key][0], textFields[key][1]);
    return { day: input.day, startLocal: input.startLocal, durationMinutes: input.durationMinutes, place: field('place'),
        route: field('route'), cost: field('cost'), weatherPlan: field('weatherPlan'), placeNotes: field('placeNotes'), scene: field('scene'),
        choices, sourceNumbers: input.sourceNumbers, ...(input.visuals !== undefined && { visuals: readStopPhotos(input.visuals) }) };
}
export function readItinerary(value: unknown, sourceCount: number): VoyageItinerary {
    if (!record(value) || !Array.isArray(value.stops) || !value.stops.length || value.stops.length > maxStops) throw new Error('请提交按站展开的行程资料');
    const timeZone = readText(value.timeZone, 80, '目的地时区');
    try { new Intl.DateTimeFormat('en', { timeZone }); } catch { throw new Error('目的地时区无效'); }
    const stops = value.stops.map((stop: unknown) => readStop(stop, sourceCount));
    for (let i = 1; i < stops.length; i++) {
        const prev = stops[i - 1], next = stops[i];
        if (next.day < prev.day || (next.day === prev.day && next.startLocal < prev.startLocal)) throw new Error('分站资料须按目的地当地时间排序');
    }
    return { timeZone, stops };
}
