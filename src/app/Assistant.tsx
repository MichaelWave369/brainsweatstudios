import { useState } from 'react';
import { useStudio } from '../systems/StudioContext';
import { recommend } from '../systems/coach';
import { isAdvanced } from '../games/advanced/models';
import Icon from '../components/Icon';
export default function Assistant() {
  const { save, profile } = useStudio(); const [question, setQuestion] = useState(''); const [goal, setGoal] = useState('');
  const plan = recommend(save, goal);
  return <section className="assistant-page"><div className="page-heading"><div><span className="eyebrow">Local studio guide</span><h1>Your personal assistant</h1><p>Works offline using authored guidance and your saved progress.</p></div><Icon name="brain" size={40} /></div>
    <div className="assistant-intro"><h2>Your next step</h2><p><span translate="no">{profile.label}</span>: {plan.guidance.hint}</p><a className="btn primary" href={`#${plan.game.route}?mission=${plan.mission + 1}`}>{plan.game.title} · Mission {plan.mission + 1}<Icon name="right" size={18} /></a>{isAdvanced(plan.game.id) && <a className="btn secondary" href={`#/classes?world=${plan.game.id}`}>Explore related classes</a>}<p className="small muted">No cloud model, account, or private chat history. You can ask about a learning topic; the guide matches it to practical activities.</p></div>
    <form className="assistant-form" onSubmit={e => { e.preventDefault(); setGoal(question); }}><label htmlFor="learning-goal">Ask your assistant</label><input id="learning-goal" maxLength={500} value={question} placeholder="Try: plan a garden, learn money, or compose music" onChange={e => setQuestion(e.target.value)} /><button className="btn primary" type="submit">Send to assistant</button></form>
    <div className="game-actions">{['Plan my next session', 'Calculus', 'Engine', 'Robot', 'Virtual machine', 'Cooking', 'Streaming', 'Music', 'Botany', 'Sound science', 'Money'].map(label => <button className="btn secondary" key={label} onClick={() => { setGoal(label === 'Plan my next session' ? '' : label); setQuestion(label === 'Plan my next session' ? '' : label); }}>{label}</button>)}</div>
    <h2 className="section-title">Your three-person council</h2><div className="council-grid"><article className="council-card mentor"><Icon name="brain" size={26} /><h3>Mentor</h3><p>{plan.guidance.hint}</p><p className="small muted">{plan.guidance.mistake}</p></article><article className="council-card benefactor"><Icon name="heart" size={26} /><h3>Benefactor</h3><p>{plan.guidance.resources}</p><p className="small muted">Support means using available learning resources and asking appropriate people for help. This role does not provide real funds.</p></article><article className="council-card strategist"><Icon name="compass" size={26} /><h3>Strategist</h3><ol>{plan.guidance.steps.map(step => <li key={step}>{step}</li>)}</ol></article></div>
    <div className="prose-panel"><h2>A guide you control</h2><p>The council offers three perspectives, not commands. Choose the idea that fits your goal. It can help with the studio’s fictional activities; it does not diagnose health, identify edible wild plants, arrange employment, or make real financial decisions.</p></div>
  </section>;
}
