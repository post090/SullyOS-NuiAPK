import React, {useState} from 'react';
import {HOME_DEFINITIONS, type HomeDefinition, type HomeDefinitionKind} from './homeDefinition';
import './homeDefinition.css';
import {House,Intersect,Robot} from '@phosphor-icons/react';
import HomeScheduleTip from './HomeScheduleTip';

export default function HomeDefinitionForm({value, onSave, onBack, recommendSchedule=false}: {value?: HomeDefinition; onSave: (value: HomeDefinition) => void; onBack: () => void; recommendSchedule?: boolean}) {
  const [kind, setKind] = useState<HomeDefinitionKind | undefined>(value?.kind);
  const [notes, setNotes] = useState(value?.notes ?? '');
  const selected = HOME_DEFINITIONS.find(option => option.kind === kind);
  return <section className="home-definition" aria-labelledby="home-definition-title">
    <div className="home-definition-content">
      <button type="button" className="home-definition-back" onClick={onBack}>{value ? '取消修改' : '返回'}</button>
      <p className="home-definition-eyebrow">入住 · 认识这个家</p>
      <h1 id="home-definition-title">这里，是你们怎样的家？</h1>
      <p className="home-definition-intro">选一个你们都自在的解释。</p>
      <form onSubmit={event => {event.preventDefault(); if (kind) onSave({kind, notes: notes.trim()});}}>
        <fieldset>
          <legend className="home-definition-sr">家园定义</legend>
          {HOME_DEFINITIONS.map((option,index) => <label key={option.kind} className="home-definition-option">
            <input type="radio" name="home-definition" value={option.kind} checked={kind === option.kind} onChange={() => setKind(option.kind)} required />
            <span className="home-definition-symbol" aria-hidden="true">{index===0?<House/>:index===1?<Intersect/>:<Robot/>}</span><span><strong>{option.title}</strong><span>{index===0?'原本世界里的共同住所':index===1?'各有各的世界，在这里相见':'彼此知晓 AI 身份的陪伴空间'}</span></span>
          </label>)}
        </fieldset>
        <details className="home-definition-extra"><summary>补充设定 · 选填</summary>{selected && <p className="home-definition-detail">{selected.detail}</p>}<label className="home-definition-notes">你们自己的解释
          <textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} maxLength={2000} placeholder="比如：我们各自生活，闲暇时会来这里见面。" />
        </label></details>
        {!value&&recommendSchedule&&<HomeScheduleTip/>}
        <button className="home-definition-submit" type="submit" disabled={!kind}>{value ? '保存设定' : '下一步'}</button>
        <p className="home-onboarding-footnote">以后可以在「我的家」中修改</p>
      </form>
    </div>
  </section>;
}
