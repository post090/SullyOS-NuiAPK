import {beforeEach,expect,it,vi} from 'vitest';
import {cleanCharacterWeatherCities,weatherForCharacter} from './characterWeather';
import {RealtimeContextManager,defaultRealtimeConfig} from './realtimeContext';
import {buildToolConfig,parseToolConfig} from './amsgToolPack';
// fork 的 fetchWeather 走 realtimeContext 自带的带超时双源实现（不走 realtimeWorldCore
// 那份裸 fetch 版），所以这里用 global.fetch 打桩驱动，断言按城市 + apiKey 隔离缓存。
beforeEach(()=>{vi.clearAllMocks();RealtimeContextManager.clearCache();});
it('resolves by stable ID and preserves default city for new characters',()=>{
    const cfg={...defaultRealtimeConfig,weatherEnabled:true,weatherCity:'北京',weatherCities:{a:' 上海 ',b:'London'},feishuEnabled:false,feishuAppId:'',feishuAppSecret:'',feishuBaseId:'',feishuTableId:'',xhsEnabled:false};
    expect(weatherForCharacter(cfg,'a').weatherCity).toBe('上海');expect(weatherForCharacter(cfg,'b').weatherCity).toBe('London');
    expect(weatherForCharacter(cfg,'new').weatherCity).toBe('北京');expect(cfg.weatherCity).toBe('北京');
    expect(cleanCharacterWeatherCities({a:' 上海 ',b:' ',c:2})).toEqual({a:'上海'});
    expect(parseToolConfig(JSON.stringify(buildToolConfig(cfg)))?.weatherCities).toEqual({a:'上海',b:'London'});
});
it('isolates cached weather by city and key, including failed city switches',async()=>{
    const json=(body:any,ok=true,status=200)=>({ok,status,headers:new Headers({'content-type':'application/json'}),text:async()=>JSON.stringify(body)}) as any;
    const geo=(name:string)=>({results:[{latitude:31,longitude:121,name}]});
    const forecast=()=>({current:{temperature_2m:20,apparent_temperature:20,relative_humidity_2m:50,weather_code:0}});
    global.fetch=vi.fn()
        .mockResolvedValueOnce(json(geo('上海')))          // 上海 geocoding
        .mockResolvedValueOnce(json(forecast()))           // 上海 forecast
        .mockResolvedValueOnce(json(geo('London')))        // London geocoding
        .mockResolvedValueOnce(json(forecast()))           // London forecast
        .mockResolvedValueOnce(json({results:[]}))         // Paris geocoding：找不到城市
        .mockResolvedValueOnce(json({},false,500))         // 换 key 后 OWM 500
        .mockResolvedValueOnce(json({},false,500));        // 回落 Open-Meteo forecast 也 500
    const cfg={...defaultRealtimeConfig,weatherEnabled:true,weatherCity:'上海'};
    expect((await RealtimeContextManager.fetchWeather(cfg))?.city).toBe('上海');
    expect((await RealtimeContextManager.fetchWeather({...cfg,weatherCity:'London'}))?.city).toBe('London');
    expect((await RealtimeContextManager.fetchWeather(cfg))?.city).toBe('上海');
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(await RealtimeContextManager.fetchWeather({...cfg,weatherCity:'Paris'})).toBeNull();
    // 同城换 apiKey = 换了数据源账号，缓存不命中；两源都挂且无该键陈旧缓存 → null。
    expect(await RealtimeContextManager.fetchWeather({...cfg,weatherApiKey:'new-key'})).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(7);
});
