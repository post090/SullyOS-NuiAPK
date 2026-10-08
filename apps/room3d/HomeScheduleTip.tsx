import React from 'react';
import {HOME_SCHEDULE_RECOMMENDATION} from '../../utils/homeScheduleRecommendation';
import './homeScheduleTip.css';

export default function HomeScheduleTip(){
 return <aside className="home-schedule-tip" aria-label="日程功能推荐"><strong>让小屋跟着 TA 的日程生活</strong><p>{HOME_SCHEDULE_RECOMMENDATION}</p><small>也可以先自由体验，稍后再开启。</small></aside>;
}
