export type Disposition = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Dead' | 'Unresponsive'
export type ReminderStatus = 'upcoming' | 'due-soon' | 'overdue' | 'completed'
export type CallOutcome = 'Connected' | 'No Answer' | 'Callback Requested' | 'Voicemail' | 'Wrong Number'

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string
  city: string
  source: 'Meta' | 'Google' | 'Website' | 'Manual' | 'Referral'
  disposition: Disposition
  owner: string
  nextFollowUp: string | null
  reminderStatus: ReminderStatus | null
  budget: string
  plotOwned: boolean
  buildType: string
  lastActivity: string
  createdAt: string
  campaign?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export type CallStage = 'new-lead' | 'connected' | 'contacted' | 'not-contacted'

export interface TranscriptLine {
  speaker: 'rep' | 'lead'
  text: string
  timestamp: string
}

export interface CallLog {
  id: string
  leadId: string
  leadName: string
  phone: string
  representative: string
  startedAt: string
  endedAt: string
  duration: number
  recordingUrl: string | null
  outcome: CallOutcome
  stage: CallStage
  notes: string
  transcript: TranscriptLine[]
}

export interface Activity {
  id: string
  type: 'call' | 'lead_assigned' | 'reminder_set' | 'disposition_changed' | 'note_added' | 'lead_accepted'
  actor: string
  description: string
  leadName?: string
  timestamp: string
  color: string
}

export interface Reminder {
  id: string
  leadId: string
  leadName: string
  owner: string
  actionType: string
  dueAt: string
  status: ReminderStatus
  priority: 'high' | 'medium' | 'low'
  notes?: string
}

export interface QueueItem {
  id: string
  leadId: string
  leadName: string
  city: string
  source: string
  age: string
  skipCount: number
  ownerHistory: string[]
  reason: 'timed-out' | 'skipped' | 'unassigned' | 'escalated'
  urgency: 'critical' | 'high' | 'medium'
}

export const leads: Lead[] = [
  { id: 'L001', name: 'Arjun Sharma', phone: '+91 98201 34567', city: 'Mumbai', source: 'Meta', disposition: 'Qualified', owner: 'Priya Sharma', nextFollowUp: '2026-03-28T10:00', reminderStatus: 'overdue', budget: '1.5 Cr', plotOwned: true, buildType: '1200 Sq Ft', lastActivity: '2 hours ago', createdAt: '2026-03-20' },
  { id: 'L002', name: 'Priya Patel', phone: '+91 91234 56789', city: 'Ahmedabad', source: 'Google', disposition: 'New', owner: 'Rahul Singh', nextFollowUp: '2026-03-28T14:00', reminderStatus: 'due-soon', budget: '2.2 Cr', plotOwned: false, buildType: '3 BHK', lastActivity: '5 hours ago', createdAt: '2026-03-27' },
  { id: 'L003', name: 'Vikram Mehta', phone: '+91 99887 65432', city: 'Bangalore', source: 'Referral', disposition: 'Proposal', owner: 'Priya Sharma', nextFollowUp: '2026-03-29T09:00', reminderStatus: 'upcoming', budget: '3.5 Cr', plotOwned: true, buildType: '2400 Sq Ft', lastActivity: '1 day ago', createdAt: '2026-03-15' },
  { id: 'L004', name: 'Sneha Iyer', phone: '+91 87654 32109', city: 'Chennai', source: 'Meta', disposition: 'Contacted', owner: 'Amit Kumar', nextFollowUp: null, reminderStatus: null, budget: '80 L', plotOwned: false, buildType: '2 BHK', lastActivity: '3 days ago', createdAt: '2026-03-25' },
  { id: 'L005', name: 'Rohit Desai', phone: '+91 70123 45678', city: 'Pune', source: 'Website', disposition: 'Dead', owner: 'Rahul Singh', nextFollowUp: null, reminderStatus: null, budget: '1.8 Cr', plotOwned: false, buildType: '1800 Sq Ft', lastActivity: '1 week ago', createdAt: '2026-03-10' },
  { id: 'L006', name: 'Anjali Gupta', phone: '+91 98765 43210', city: 'Delhi', source: 'Google', disposition: 'Negotiation', owner: 'Priya Sharma', nextFollowUp: '2026-03-28T16:00', reminderStatus: 'overdue', budget: '4 Cr', plotOwned: true, buildType: '4 BHK', lastActivity: '4 hours ago', createdAt: '2026-03-08' },
  { id: 'L007', name: 'Rohan Verma', phone: '+91 91111 22222', city: 'Hyderabad', source: 'Meta', disposition: 'Qualified', owner: 'Amit Kumar', nextFollowUp: '2026-03-30T11:00', reminderStatus: 'upcoming', budget: '2.8 Cr', plotOwned: false, buildType: '3 BHK', lastActivity: '6 hours ago', createdAt: '2026-03-22' },
  { id: 'L008', name: 'Kavya Nair', phone: '+91 93333 44444', city: 'Kolkata', source: 'Manual', disposition: 'New', owner: null as unknown as string, nextFollowUp: null, reminderStatus: null, budget: '1.2 Cr', plotOwned: true, buildType: '1500 Sq Ft', lastActivity: 'Just now', createdAt: '2026-03-28' },
  { id: 'L009', name: 'Suresh Nambiar', phone: '+91 96666 77777', city: 'Kochi', source: 'Referral', disposition: 'Won', owner: 'Priya Sharma', nextFollowUp: null, reminderStatus: 'completed', budget: '5 Cr', plotOwned: true, buildType: '3200 Sq Ft', lastActivity: '2 days ago', createdAt: '2026-02-15' },
  { id: 'L010', name: 'Meena Krishnan', phone: '+91 94444 55555', city: 'Bangalore', source: 'Google', disposition: 'Contacted', owner: 'Amit Kumar', nextFollowUp: '2026-03-29T10:00', reminderStatus: 'upcoming', budget: '3 Cr', plotOwned: false, buildType: '2800 Sq Ft', lastActivity: '8 hours ago', createdAt: '2026-03-26' },
]

export const activities: Activity[] = [
  { id: 'A001', type: 'call', actor: 'Priya Sharma', description: 'Called Arjun Sharma — Qualified, follow-up set', leadName: 'Arjun Sharma', timestamp: '2 min ago', color: 'blue' },
  { id: 'A002', type: 'lead_accepted', actor: 'Amit Kumar', description: 'Accepted new lead from Meta', leadName: 'Rohan Verma', timestamp: '14 min ago', color: 'green' },
  { id: 'A003', type: 'reminder_set', actor: 'Rahul Singh', description: 'Follow-up set for tomorrow 10:00 AM', leadName: 'Priya Patel', timestamp: '32 min ago', color: 'amber' },
  { id: 'A004', type: 'disposition_changed', actor: 'Priya Sharma', description: 'Moved to Negotiation stage', leadName: 'Anjali Gupta', timestamp: '1 hr ago', color: 'purple' },
  { id: 'A005', type: 'lead_assigned', actor: 'System', description: 'New lead assigned from Google Ads', leadName: 'Meena Krishnan', timestamp: '2 hr ago', color: 'blue' },
  { id: 'A006', type: 'note_added', actor: 'Rahul Singh', description: 'Budget revised to 1.8 Cr, customer prefers 3 BHK', leadName: 'Priya Patel', timestamp: '3 hr ago', color: 'slate' },
  { id: 'A007', type: 'call', actor: 'Amit Kumar', description: 'No answer — callback scheduled', leadName: 'Sneha Iyer', timestamp: '4 hr ago', color: 'red' },
  { id: 'A008', type: 'lead_accepted', actor: 'Rahul Singh', description: 'Accepted incoming lead from website', leadName: 'Kavya Nair', timestamp: '5 hr ago', color: 'green' },
]

export const reminders: Reminder[] = [
  { id: 'R001', leadId: 'L001', leadName: 'Arjun Sharma', owner: 'Priya Sharma', actionType: 'Follow-up Call', dueAt: '2026-03-28T10:00', status: 'overdue', priority: 'high', notes: 'Customer wants revised floor plan' },
  { id: 'R002', leadId: 'L006', leadName: 'Anjali Gupta', owner: 'Priya Sharma', actionType: 'Send Proposal', dueAt: '2026-03-28T16:00', status: 'overdue', priority: 'high', notes: 'Final proposal with 10% discount' },
  { id: 'R003', leadId: 'L002', leadName: 'Priya Patel', owner: 'Rahul Singh', actionType: 'Follow-up Call', dueAt: '2026-03-28T14:00', status: 'due-soon', priority: 'medium', notes: 'Discuss home loan options' },
  { id: 'R004', leadId: 'L010', leadName: 'Meena Krishnan', owner: 'Amit Kumar', actionType: 'Site Visit', dueAt: '2026-03-29T10:00', status: 'upcoming', priority: 'medium', notes: 'Show Phase 2 apartments' },
  { id: 'R005', leadId: 'L003', leadName: 'Vikram Mehta', owner: 'Priya Sharma', actionType: 'Follow-up Call', dueAt: '2026-03-29T09:00', status: 'upcoming', priority: 'low' },
  { id: 'R006', leadId: 'L007', leadName: 'Rohan Verma', owner: 'Amit Kumar', actionType: 'Meeting', dueAt: '2026-03-30T11:00', status: 'upcoming', priority: 'medium', notes: 'Office meeting to finalize agreement' },
  { id: 'R007', leadId: 'L009', leadName: 'Suresh Nambiar', owner: 'Priya Sharma', actionType: 'Follow-up Call', dueAt: '2026-03-26T11:00', status: 'completed', priority: 'high' },
]

export const queueItems: QueueItem[] = [
  { id: 'Q001', leadId: 'L011', leadName: 'Dinesh Kapoor', city: 'Mumbai', source: 'Meta', age: '48 min', skipCount: 3, ownerHistory: ['Priya Sharma', 'Rahul Singh', 'Amit Kumar'], reason: 'timed-out', urgency: 'critical' },
  { id: 'Q002', leadId: 'L012', leadName: 'Lakshmi Reddy', city: 'Hyderabad', source: 'Google', age: '1h 22min', skipCount: 2, ownerHistory: ['Rahul Singh', 'Amit Kumar'], reason: 'skipped', urgency: 'high' },
  { id: 'Q003', leadId: 'L013', leadName: 'Karan Malhotra', city: 'Delhi', source: 'Website', age: '3h 10min', skipCount: 0, ownerHistory: [], reason: 'unassigned', urgency: 'high' },
  { id: 'Q004', leadId: 'L014', leadName: 'Divya Menon', city: 'Chennai', source: 'Referral', age: '22 min', skipCount: 1, ownerHistory: ['Priya Sharma'], reason: 'escalated', urgency: 'medium' },
]

export const teamPerformance = [
  { name: 'Priya Sharma', role: 'Senior Representative', leadsAssigned: 42, callsMade: 38, qualified: 18, won: 6, overdue: 2, convRate: 43, conversionRate: '47.4%', avgCallDuration: '5m 12s', score: 92, avgResponseMin: 8 },
  { name: 'Amit Kumar', role: 'Representative', leadsAssigned: 33, callsMade: 29, qualified: 14, won: 5, overdue: 1, convRate: 42, conversionRate: '42.4%', avgCallDuration: '4m 38s', score: 88, avgResponseMin: 6 },
  { name: 'Rahul Singh', role: 'Representative', leadsAssigned: 37, callsMade: 31, qualified: 12, won: 4, overdue: 5, convRate: 32, conversionRate: '32.5%', avgCallDuration: '3m 55s', score: 74, avgResponseMin: 14 },
]

export const callOutcomeData = [
  { name: 'Connected', value: 58, fill: '#16A34A' },
  { name: 'No Answer', value: 22, fill: '#F59E0B' },
  { name: 'Callback', value: 12, fill: '#3B82F6' },
  { name: 'Voicemail', value: 6, fill: '#94A3B8' },
  { name: 'Wrong No.', value: 2, fill: '#DC2626' },
]

export const callOutcomes = [
  { outcome: 'Connected', count: 202, percentage: 58, color: '#16A34A' },
  { outcome: 'No Answer', count: 77, percentage: 22, color: '#F59E0B' },
  { outcome: 'Callback Requested', count: 42, percentage: 12, color: '#3B82F6' },
  { outcome: 'Voicemail', count: 21, percentage: 6, color: '#94A3B8' },
  { outcome: 'Wrong Number', count: 6, percentage: 2, color: '#DC2626' },
]

export const sourceData = [
  { month: 'Jan', Meta: 24, Google: 18, Website: 9, Referral: 6, Manual: 3 },
  { month: 'Feb', Meta: 28, Google: 21, Website: 12, Referral: 8, Manual: 2 },
  { month: 'Mar', Meta: 32, Google: 26, Website: 10, Referral: 11, Manual: 4 },
]

export const auditLogs = [
  { id: 'AU001', timestamp: '2026-03-28 14:23', actor: 'Priya Sharma', action: 'Disposition Changed', entity: 'Lead: Anjali Gupta', before: 'Qualified', after: 'Negotiation', role: 'Representative' },
  { id: 'AU002', timestamp: '2026-03-28 13:45', actor: 'System', action: 'Lead Assigned', entity: 'Lead: Meena Krishnan', before: 'Unassigned', after: 'Amit Kumar', role: 'System' },
  { id: 'AU003', timestamp: '2026-03-28 12:10', actor: 'Amit Kumar', action: 'Reminder Set', entity: 'Lead: Rohan Verma', before: '—', after: '30 Mar 11:00 AM', role: 'Representative' },
  { id: 'AU004', timestamp: '2026-03-28 11:33', actor: 'Manager', action: 'Lead Marked Dead', entity: 'Lead: Rohit Desai', before: 'Contacted', after: 'Dead', role: 'Manager' },
  { id: 'AU005', timestamp: '2026-03-28 10:58', actor: 'Rahul Singh', action: 'Call Logged', entity: 'Lead: Priya Patel', before: '—', after: 'Connected — 4 min 22 sec', role: 'Representative' },
  { id: 'AU006', timestamp: '2026-03-28 09:20', actor: 'System', action: 'Lead Offer Timed Out', entity: 'Lead: Dinesh Kapoor', before: 'Priya Sharma (offered)', after: 'Queue (timed out)', role: 'System' },
  { id: 'AU007', timestamp: '2026-03-27 17:45', actor: 'Priya Sharma', action: 'Note Added', entity: 'Lead: Arjun Sharma', before: '—', after: 'Customer needs revised floor plan', role: 'Representative' },
]

export const incomingLeadMock = {
  id: 'L999',
  name: 'Nikhil Joshi',
  phone: '+91 98888 77766',
  city: 'Pune',
  source: 'Meta',
  campaign: 'Dream Homes 2026',
  budget: '2 Cr',
  plotOwned: false,
  receivedAt: new Date().toISOString(),
}

export const callLogs: CallLog[] = [
  {
    id: 'C001',
    leadId: 'L001',
    leadName: 'Arjun Sharma',
    phone: '+91 98201 34567',
    representative: 'Priya Sharma',
    startedAt: '2026-03-28T09:30:00',
    endedAt: '2026-03-28T09:34:22',
    duration: 262,
    recordingUrl: '/recordings/call_001.mp3',
    outcome: 'Connected',
    stage: 'connected',
    notes: 'Customer wants revised floor plan with extended parking area',
    transcript: [
      { speaker: 'rep', text: 'Hello, this is Priya from BuildFlow. Am I speaking with Arjun Sharma?', timestamp: '00:00' },
      { speaker: 'lead', text: 'Yes, speaking. How can I help you?', timestamp: '00:03' },
      { speaker: 'rep', text: 'Thank you for your interest in our premium villas. I wanted to discuss your requirements.', timestamp: '00:08' },
      { speaker: 'lead', text: 'Actually, I wanted to know if you can modify the standard design a bit.', timestamp: '00:15' },
      { speaker: 'rep', text: 'Of course, what kind of modifications are you looking for?', timestamp: '00:22' },
      { speaker: 'lead', text: 'I need an extended parking area that can fit two SUVs.', timestamp: '00:28' },
      { speaker: 'rep', text: 'That is definitely possible. Let me send you a revised design by tomorrow.', timestamp: '00:35' },
      { speaker: 'lead', text: 'Perfect, thank you!', timestamp: '00:42' },
    ]
  },
  {
    id: 'C002',
    leadId: 'L001',
    leadName: 'Arjun Sharma',
    phone: '+91 98201 34567',
    representative: 'Priya Sharma',
    startedAt: '2026-03-26T14:15:00',
    endedAt: '2026-03-26T14:18:45',
    duration: 225,
    recordingUrl: '/recordings/call_002.mp3',
    outcome: 'No Answer',
    stage: 'new-lead',
    notes: 'First attempt, customer did not pick up',
    transcript: [
      { speaker: 'rep', text: 'Ringing...', timestamp: '00:00' },
      { speaker: 'rep', text: 'No response', timestamp: '00:45' },
    ]
  },
  {
    id: 'C003',
    leadId: 'L002',
    leadName: 'Priya Patel',
    phone: '+91 91234 56789',
    representative: 'Rahul Singh',
    startedAt: '2026-03-28T11:00:00',
    endedAt: '2026-03-28T11:08:30',
    duration: 510,
    recordingUrl: '/recordings/call_003.mp3',
    outcome: 'Connected',
    stage: 'contacted',
    notes: 'Discussed home loan options, customer is interested in 3 BHK',
    transcript: [
      { speaker: 'rep', text: 'Good morning Priya ji, this is Rahul from BuildFlow.', timestamp: '00:00' },
      { speaker: 'lead', text: 'Good morning Rahul, yes I remember your call.', timestamp: '00:05' },
      { speaker: 'rep', text: 'You had asked about home loan options. I have some good news.', timestamp: '00:12' },
      { speaker: 'lead', text: 'Yes please tell me, what are the rates looking like?', timestamp: '00:18' },
      { speaker: 'rep', text: 'We have partnered with HDFC and SBI, starting at 8.4% interest.', timestamp: '00:25' },
      { speaker: 'lead', text: 'That sounds reasonable. What would be the EMI for a 2 crore loan?', timestamp: '00:33' },
      { speaker: 'rep', text: 'For 20 years, your EMI would be approximately 1.72 lakhs per month.', timestamp: '00:42' },
      { speaker: 'lead', text: 'Okay, and which banks offer the best processing time?', timestamp: '00:52' },
      { speaker: 'rep', text: 'HDFC typically processes within 7-10 working days.', timestamp: '01:05' },
      { speaker: 'lead', text: 'Good to know. I am interested in the 3 BHK option.', timestamp: '01:15' },
    ]
  },
  {
    id: 'C004',
    leadId: 'L006',
    leadName: 'Anjali Gupta',
    phone: '+91 98765 43210',
    representative: 'Priya Sharma',
    startedAt: '2026-03-28T15:30:00',
    endedAt: '2026-03-28T15:45:00',
    duration: 900,
    recordingUrl: '/recordings/call_004.mp3',
    outcome: 'Connected',
    stage: 'connected',
    notes: 'Final negotiation on 4 BHK, discussed 10% discount possibility',
    transcript: [
      { speaker: 'rep', text: 'Hi Anjali ji, Priya here. I wanted to discuss the proposal we sent.', timestamp: '00:00' },
      { speaker: 'lead', text: 'Hi Priya, yes I received it. The pricing is slightly above our budget.', timestamp: '00:08' },
      { speaker: 'rep', text: 'I understand. What is your comfortable budget range?', timestamp: '00:18' },
      { speaker: 'lead', text: 'We were looking at around 3.5 crores all inclusive.', timestamp: '00:26' },
      { speaker: 'rep', text: 'The current quote is 4 crores. Let me check if we can offer a special discount.', timestamp: '00:38' },
      { speaker: 'lead', text: 'That would be helpful. We are ready to finalize if it fits our budget.', timestamp: '00:50' },
      { speaker: 'rep', text: 'I can offer you a 10% discount which brings it to 3.6 crores. Is that workable?', timestamp: '01:05' },
      { speaker: 'lead', text: '3.6 crores is manageable. Can we meet tomorrow to finalize?', timestamp: '01:20' },
      { speaker: 'rep', text: 'Absolutely. I will schedule the meeting for 11 AM at our office.', timestamp: '01:32' },
    ]
  },
  {
    id: 'C005',
    leadId: 'L004',
    leadName: 'Sneha Iyer',
    phone: '+91 87654 32109',
    representative: 'Amit Kumar',
    startedAt: '2026-03-25T16:00:00',
    endedAt: '2026-03-25T16:00:30',
    duration: 30,
    recordingUrl: null,
    outcome: 'Callback Requested',
    stage: 'not-contacted',
    notes: 'Customer requested callback tomorrow morning',
    transcript: [
      { speaker: 'rep', text: 'Hello Sneha ji, Amit from BuildFlow...', timestamp: '00:00' },
      { speaker: 'lead', text: 'I am busy right now, can you call tomorrow morning?', timestamp: '00:05' },
      { speaker: 'rep', text: 'Of course, I will call you at 10 AM tomorrow.', timestamp: '00:10' },
    ]
  },
  {
    id: 'C006',
    leadId: 'L010',
    leadName: 'Meena Krishnan',
    phone: '+91 94444 55555',
    representative: 'Amit Kumar',
    startedAt: '2026-03-27T14:00:00',
    endedAt: '2026-03-27T14:15:00',
    duration: 900,
    recordingUrl: '/recordings/call_006.mp3',
    outcome: 'Connected',
    stage: 'connected',
    notes: 'Showed Phase 2 apartments virtually, customer interested in 2800 sq ft unit',
    transcript: [
      { speaker: 'rep', text: 'Good afternoon Meena ji, I am ready to show you the Phase 2 apartments.', timestamp: '00:00' },
      { speaker: 'lead', text: 'Yes Amit, I am excited to see them.', timestamp: '00:06' },
      { speaker: 'rep', text: 'Let me share my screen. This is the 2800 sq ft 4 BHK unit.', timestamp: '00:15' },
    ]
  },
  {
    id: 'C007',
    leadId: 'L007',
    leadName: 'Rohan Verma',
    phone: '+91 91111 22222',
    representative: 'Amit Kumar',
    startedAt: '2026-03-26T10:00:00',
    endedAt: '2026-03-26T10:02:00',
    duration: 120,
    recordingUrl: '/recordings/call_007.mp3',
    outcome: 'Voicemail',
    stage: 'new-lead',
    notes: 'Left voicemail introducing BuildFlow services',
    transcript: [
      { speaker: 'rep', text: 'Hello Rohan ji, this is Amit from BuildFlow...', timestamp: '00:00' },
      { speaker: 'rep', text: 'Please call me back at your convenience.', timestamp: '00:30' },
    ]
  },
]
