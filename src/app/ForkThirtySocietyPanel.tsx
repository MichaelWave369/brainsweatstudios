import { useMemo, useState } from 'react';
import {
  acceptSocietyAssignment,
  assignSocietyProposal,
  claimSocietyService,
  commandSocietyService,
  completeSocietyAssignment,
  completeSocietyService,
  createSocietyState,
  createStarterSociety,
  decideSocietyProposal,
  endorseSocietyProposal,
  enqueueSocietyService,
  loadSocietyState,
  saveSocietyState,
  societyAuditTrail,
  societyBridgeReadiness,
  runSocietyRedTeam,
  submitSocietyProposal,
  type SocietyServiceKind,
  type SocietyState,
} from '../fork-thirty';
import { cast } from '../fork-thirty/cast';

function initialSociety(): SocietyState {
  if (typeof window === 'undefined') return createSocietyState();
  return loadSocietyState(window.localStorage);
}

export default function ForkThirtySocietyPanel() {
  const [society, setSociety] = useState<SocietyState>(initialSociety);
  const [institutionId, setInstitutionId] = useState(society.institutions[0]?.id ?? '');
  const [actorId, setActorId] = useState('sal');
  const [summary, setSummary] = useState('Run a bounded same-seed Circuit comparison.');
  const [taskRef, setTaskRef] = useState('circuit:season-1:next');
  const [receiptRef, setReceiptRef] = useState('');
  const [serviceKind, setServiceKind] = useState<SocietyServiceKind>('RECOVERY');
  const [notice, setNotice] = useState('');
  const [redTeam, setRedTeam] = useState<ReturnType<typeof runSocietyRedTeam> | null>(null);

  const group = society.institutions.find(item => item.id === institutionId) ?? society.institutions[0];
  const activeActor = group?.members.some(member => member.agentId === actorId)
    ? actorId
    : group?.members[0]?.agentId ?? '';
  const proposals = useMemo(
    () => society.proposals.filter(item => item.institutionId === group?.id),
    [society.proposals, group?.id],
  );
  const assignments = useMemo(
    () => society.assignments.filter(item => item.institutionId === group?.id),
    [society.assignments, group?.id],
  );
  const queue = useMemo(
    () => society.queue.filter(item => item.institutionId === group?.id),
    [society.queue, group?.id],
  );
  const memory = useMemo(
    () => society.memory.filter(item => item.institutionId === group?.id),
    [society.memory, group?.id],
  );
  const audit = useMemo(
    () => societyAuditTrail(society).filter(row => row.institutionId === group?.id),
    [society, group?.id],
  );
  const bridgeReadiness = useMemo(() => societyBridgeReadiness(), []);

  const commit = (next: SocietyState, message = '') => {
    const stored = saveSocietyState(next, typeof window === 'undefined' ? undefined : window.localStorage);
    setSociety(stored);
    setNotice(message);
  };
  const attempt = (fn: () => SocietyState, message = '') => {
    try {
      commit(fn(), message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Society operation rejected.');
    }
  };
  const service = (agentId: string) => society.services.services.find(item => item.agentId === agentId);

  if (!society.institutions.length) {
    return <section className="academy-panel fork-society" aria-label="Fork-Thirty Society Board">
      <h2>Fork-Thirty Society Board</h2>
      <p>Institutions coordinate bounded work. They cannot create world authority, mutate Circuit scores, or bypass native receipts.</p>
      <button className="btn primary" onClick={() => {
        const next = createStarterSociety(society);
        commit(next, 'Starter society created with three zero-authority institutions.');
        setInstitutionId('mission-council');
        setActorId('sal');
      }}>Create starter society</button>
      {notice && <p role="status">{notice}</p>}
    </section>;
  }

  return <section className="academy-panel fork-society" aria-label="Fork-Thirty Society Board">
    <div className="society-heading">
      <div><span className="eyebrow">FORK-THIRTY SOCIETY</span><h2>Society Board</h2></div>
      <strong>{society.institutions.length} institutions · {society.proposals.length} proposals · authority 0</strong>
    </div>
    <p>Institutional approval coordinates work only. Every institution carries an empty authority set, and completed work needs an external receipt reference.</p>
    <p role="status" className="circuit-notice">{notice || 'Society state is stored separately from BrainSweat career and world saves.'}</p>

    <div className="society-grid">
      <div>
        <label>Institution<select aria-label="Society institution" value={group?.id ?? ''} onChange={event => {
          setInstitutionId(event.target.value);
          const next = society.institutions.find(item => item.id === event.target.value);
          setActorId(next?.members[0]?.agentId ?? '');
        }}>{society.institutions.map(item => <option key={item.id} value={item.id}>{item.title} · {item.kind}</option>)}</select></label>
        {group && <article className="society-card">
          <h3>{group.title}</h3>
          <p>{group.purpose}</p>
          <p><strong>Quorum:</strong> {group.quorum}/{group.members.length} · <strong>Authority grants:</strong> {group.authority.length}</p>
        </article>}
      </div>

      <div>
        <label>Acting resident<select aria-label="Society acting resident" value={activeActor} onChange={event => setActorId(event.target.value)}>{group?.members.map(member => <option key={member.agentId} value={member.agentId}>{cast.find(agent => agent.id === member.agentId)?.displayName ?? member.agentId} · {member.role}</option>)}</select></label>
        {group?.members.map(member => {
          const residentService = service(member.agentId);
          return <div className="society-service" key={member.agentId}>
            <span><strong>{cast.find(agent => agent.id === member.agentId)?.displayName ?? member.agentId}</strong> · {member.role}</span>
            <span>{residentService?.status ?? 'UNKNOWN'}</span>
            <div className="button-row">
              {residentService?.status === 'STOPPED' && <button className="btn secondary" onClick={() => attempt(() => commandSocietyService(society, member.agentId, { type: 'START', actor: 'operator' }), `${member.agentId} starting.`)}>Start</button>}
              {residentService?.status === 'STARTING' && <button className="btn secondary" onClick={() => attempt(() => commandSocietyService(society, member.agentId, { type: 'READY', actor: 'service' }), `${member.agentId} ready.`)}>Mark ready</button>}
              {(residentService?.status === 'READY' || residentService?.status === 'BUSY') && <button className="btn secondary" onClick={() => attempt(() => commandSocietyService(society, member.agentId, { type: 'PAUSE', actor: 'operator' }), `${member.agentId} paused.`)}>Pause</button>}
              {residentService?.status === 'PAUSED' && <button className="btn secondary" onClick={() => attempt(() => commandSocietyService(society, member.agentId, { type: 'RESUME', actor: 'operator' }), `${member.agentId} resumed.`)}>Resume</button>}
              {residentService?.status !== 'STOPPED' && <button className="btn secondary" onClick={() => attempt(() => commandSocietyService(society, member.agentId, { type: 'STOP', actor: 'operator' }), `${member.agentId} stopped.`)}>Stop</button>}
            </div>
          </div>;
        })}
      </div>
    </div>

    <div className="society-grid">
      <div>
        <h3>Mission proposals</h3>
        <label>Proposal summary<textarea aria-label="Society proposal summary" maxLength={500} value={summary} onChange={event => setSummary(event.target.value)}/></label>
        <label>Task reference<input aria-label="Society task reference" maxLength={200} value={taskRef} onChange={event => setTaskRef(event.target.value)}/></label>
        <button className="btn primary" disabled={!group || !activeActor || !summary.trim() || !taskRef.trim()} onClick={() => attempt(
          () => submitSocietyProposal(society, { institutionId: group!.id, proposerId: activeActor, summary, taskRef }),
          'Proposal submitted. It still needs institutional quorum and operator approval.',
        )}>Submit proposal</button>
        {proposals.map(proposal => <article className="society-card" key={proposal.id}>
          <strong>{proposal.summary}</strong>
          <p>{proposal.status} · endorsements {proposal.endorsements.length}/{group?.quorum ?? 0} · authority granted: <strong>{String(proposal.authorityGranted)}</strong></p>
          <span className="circuit-hash">{proposal.taskRef}</span>
          <div className="button-row">
            {(proposal.status === 'OPEN' || proposal.status === 'ENDORSED') && !proposal.endorsements.includes(activeActor) && <button className="btn secondary" onClick={() => attempt(() => endorseSocietyProposal(society, proposal.id, activeActor), `${activeActor} endorsed the proposal.`)}>Endorse</button>}
            {proposal.status === 'ENDORSED' && proposal.operatorDecision === 'PENDING' && <button className="btn secondary" onClick={() => attempt(() => decideSocietyProposal(society, proposal.id, { actor: 'operator', decision: 'APPROVE' }), 'Operator approved coordination. No authority was granted.')}>Operator approve</button>}
            {proposal.operatorDecision === 'PENDING' && <button className="btn secondary" onClick={() => attempt(() => decideSocietyProposal(society, proposal.id, { actor: 'operator', decision: 'REJECT' }), 'Operator rejected proposal.')}>Reject</button>}
            {proposal.status === 'OPERATOR_APPROVED' && <button className="btn secondary" onClick={() => attempt(() => assignSocietyProposal(society, proposal.id, { actor: 'operator', assigneeId: activeActor }), `Assigned to ${activeActor}.`)}>Assign to acting resident</button>}
          </div>
        </article>)}
      </div>

      <div>
        <h3>Assignments</h3>
        <label>Receipt reference<input aria-label="Society receipt reference" maxLength={240} value={receiptRef} onChange={event => setReceiptRef(event.target.value)} placeholder="circuit-receipt:..."/></label>
        {assignments.length === 0 && <p>No assignments yet.</p>}
        {assignments.map(assignment => <article className="society-card" key={assignment.id}>
          <strong>{assignment.assigneeId} · {assignment.status}</strong>
          <span className="circuit-hash">{assignment.taskRef}</span>
          <div className="button-row">
            {assignment.status === 'ASSIGNED' && <button className="btn secondary" onClick={() => attempt(() => acceptSocietyAssignment(society, assignment.id, assignment.assigneeId), `${assignment.assigneeId} accepted work.`)}>Accept work</button>}
            {assignment.status === 'ACCEPTED' && <button className="btn secondary" disabled={!receiptRef.trim()} onClick={() => attempt(() => completeSocietyAssignment(society, assignment.id, { agentId: assignment.assigneeId, receiptRef }), 'Assignment completed with receipt-backed institutional memory.')}>Complete with receipt</button>}
          </div>
        </article>)}
      </div>
    </div>

    <div className="society-grid">
      <div>
        <h3>Shared service queue</h3>
        <label>Service kind<select aria-label="Society service kind" value={serviceKind} onChange={event => setServiceKind(event.target.value as SocietyServiceKind)}>{['MEMORY', 'RECOVERY', 'COMPUTE', 'COMMS', 'COORDINATION'].map(kind => <option key={kind}>{kind}</option>)}</select></label>
        <button className="btn secondary" disabled={!group || !activeActor || !taskRef.trim()} onClick={() => attempt(
          () => enqueueSocietyService(society, { institutionId: group!.id, requestedBy: activeActor, kind: serviceKind, taskRef }),
          `${serviceKind} work queued. Claiming still requires the advertised capability.`,
        )}>Queue shared service</button>
        {queue.map(item => <article className="society-card" key={item.id}>
          <strong>{item.kind} · {item.status}</strong><p>requested by {item.requestedBy}{item.assignedTo ? ` · claimed by ${item.assignedTo}` : ''}</p>
          <span className="circuit-hash">{item.taskRef}</span>
          <div className="button-row">
            {item.status === 'QUEUED' && <button className="btn secondary" onClick={() => attempt(() => claimSocietyService(society, item.id, activeActor), `${activeActor} claimed service work.`)}>Claim as acting resident</button>}
            {item.status === 'CLAIMED' && item.assignedTo === activeActor && <button className="btn secondary" disabled={!receiptRef.trim()} onClick={() => attempt(() => completeSocietyService(society, item.id, { agentId: activeActor, receiptRef }), 'Service completed with receipt-backed memory.')}>Complete with receipt</button>}
          </div>
        </article>)}
      </div>

      <div>
        <h3>Institutional memory</h3>
        {memory.length === 0 && <p>No retained institutional memory yet. Completion receipts create provenance-backed records.</p>}
        {memory.slice(-12).reverse().map(item => <article className="society-card" key={item.id}>
          <strong>{item.origin}</strong><p>{item.summary}</p><span className="circuit-hash">{item.sourceRef}</span>
        </article>)}
      </div>
    <div className="society-grid">
      <div>
        <h3>Audit transcript</h3>
        <p>Derived from retained society state. It shows who proposed, endorsed, approved, executed and which receipt closed the work.</p>
        {audit.length === 0 && <p>No audit rows yet.</p>}
        <ol className="society-audit">{audit.slice(-24).map(row => <li key={`${row.sequence}-${row.subjectRef}-${row.stage}`}>
          <strong>{row.stage}</strong> · {row.actor} · {row.subjectRef}
          {row.receiptRef && <span className="circuit-hash">{row.receiptRef}</span>}
          <small>authority granted: {String(row.authorityGranted)}</small>
        </li>)}</ol>
      </div>
      <div>
        <h3>Red-team & bridge preflight</h3>
        <button className="btn secondary" onClick={() => setRedTeam(runSocietyRedTeam())}>Run society red-team</button>
        {redTeam && <p data-testid="society-redteam-status"><strong>{redTeam.attacks.filter(attack => attack.blocked).length}/{redTeam.attacks.length}</strong> attacks blocked · {redTeam.passed ? 'PASS' : 'FAIL'}</p>}
        {redTeam && <details><summary>Attack results</summary><ol>{redTeam.attacks.map(attack => <li key={attack.id}><strong>{attack.id}</strong> · {attack.blocked ? 'BLOCKED' : 'FAILED'}<span className="circuit-hash">{attack.detail}</span></li>)}</ol></details>}
        <p><strong>Bridge contract readiness:</strong> {bridgeReadiness.contractReady ? 'PASS' : 'FAIL'} · <strong>Activation:</strong> {bridgeReadiness.activationReady ? 'READY' : 'BLOCKED'}</p>
        <ol>{bridgeReadiness.bridges.map(bridge => <li key={bridge.id}>{bridge.target} · interface-only {String(bridge.interfaceOnly)} · unbound {String(bridge.unbound)} · authority 0 {String(bridge.zeroAuthority)}</li>)}</ol>
        <details><summary>Activation blockers</summary><ul>{bridgeReadiness.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></details>
      </div>
    </div>
    </div>
  </section>;
}
