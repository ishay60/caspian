# Community Corrections Roadmap (Phase 7+)

## Vision

Build a community-driven quality layer over external sources, especially for Hebrew songs where rating systems don't exist. Transform Caspian from a single-user tool into a collaborative platform where users collectively improve chord sheet quality.

## Problem Statement

**Current State (Phase 2)**:
- Tab4u has no quality ratings
- Chord accuracy varies (60-95%)
- User corrections stored locally only
- No way to share improvements with community

**Desired State (Phase 7+)**:
- Community-verified chord sheets
- High-quality corrections auto-applied
- Reputation system rewards contributors
- Expert verification for popular songs
- Crowdsourced quality layer

## Architecture

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  reputation_score INTEGER DEFAULT 0,
  is_expert BOOLEAN DEFAULT FALSE,
  expert_domains TEXT[], -- e.g., ['israeli_pop', 'jazz']
  total_contributions INTEGER DEFAULT 0,
  accepted_contributions INTEGER DEFAULT 0
);

CREATE INDEX idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX idx_users_expert ON users(is_expert) WHERE is_expert = TRUE;

-- Corrections table
CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'tab4u', 'ultimate_guitar', etc.
  song_title TEXT,
  artist TEXT,

  -- Correction details
  correction_type TEXT NOT NULL, -- 'chord', 'section', 'structure', 'alignment'
  section_name TEXT,
  position JSONB, -- {line_index, chord_index, etc.}
  original_value TEXT,
  corrected_value TEXT,
  correction_data JSONB, -- full correction object

  -- Metadata
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Approval status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'superseded'
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id), -- expert who approved
  rejection_reason TEXT,

  -- Confidence scoring
  net_votes INTEGER DEFAULT 0, -- upvotes - downvotes
  confidence_score FLOAT DEFAULT 0.0, -- calculated score (0-1)
  auto_apply_threshold FLOAT DEFAULT 0.8, -- apply when confidence > this

  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'))
);

CREATE INDEX idx_corrections_url ON corrections(source_url);
CREATE INDEX idx_corrections_user ON corrections(user_id);
CREATE INDEX idx_corrections_status ON corrections(status);
CREATE INDEX idx_corrections_confidence ON corrections(confidence_score DESC);
CREATE INDEX idx_corrections_pending ON corrections(status) WHERE status = 'pending';

-- Votes table
CREATE TABLE correction_votes (
  correction_id UUID REFERENCES corrections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)), -- -1 downvote, +1 upvote
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (correction_id, user_id)
);

CREATE INDEX idx_votes_correction ON correction_votes(correction_id);
CREATE INDEX idx_votes_user ON correction_votes(user_id);

-- Correction conflicts (when multiple users suggest different corrections)
CREATE TABLE correction_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  position JSONB NOT NULL, -- identifies the conflicted element
  correction_ids UUID[] NOT NULL, -- competing corrections
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  winning_correction_id UUID REFERENCES corrections(id),
  resolution_method TEXT, -- 'voting', 'expert', 'automated'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflicts_url ON correction_conflicts(source_url);
CREATE INDEX idx_conflicts_unresolved ON correction_conflicts(resolved) WHERE resolved = FALSE;

-- Reputation events (for audit trail)
CREATE TABLE reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL, -- 'correction_submitted', 'correction_approved', 'upvote_received', etc.
  points INTEGER NOT NULL, -- can be negative
  related_correction_id UUID REFERENCES corrections(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reputation_user ON reputation_events(user_id);
CREATE INDEX idx_reputation_correction ON reputation_events(related_correction_id);

-- Expert reviews (for quality assurance)
CREATE TABLE expert_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id UUID REFERENCES corrections(id),
  expert_id UUID REFERENCES users(id),
  verdict TEXT NOT NULL CHECK (verdict IN ('approve', 'reject', 'request_changes')),
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT expert_must_be_expert CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = expert_id AND is_expert = TRUE)
  )
);

CREATE INDEX idx_expert_reviews_correction ON expert_reviews(correction_id);
CREATE INDEX idx_expert_reviews_expert ON expert_reviews(expert_id);
```

### Confidence Scoring Algorithm

```python
def calculate_confidence_score(correction):
    """
    Calculate confidence score (0-1) for a correction.
    Higher score = more likely to be correct.
    """
    # Base components
    upvotes = correction.upvotes
    downvotes = correction.downvotes
    total_votes = upvotes + downvotes

    # 1. Vote-based confidence (Wilson score)
    if total_votes == 0:
        vote_confidence = 0.0
    else:
        wilson_score = wilson_score_interval(upvotes, total_votes)
        vote_confidence = wilson_score

    # 2. Submitter reputation weight
    submitter_rep = correction.user.reputation_score
    max_rep = 1000  # cap
    rep_weight = min(submitter_rep / max_rep, 0.2)  # max 0.2 boost

    # 3. Time decay (older corrections with few votes decay)
    days_old = (now() - correction.created_at).days
    if total_votes < 5 and days_old > 30:
        time_penalty = 0.1 * (days_old - 30) / 30  # -0.1 per month
    else:
        time_penalty = 0.0

    # 4. Expert verification bonus
    if correction.expert_verified:
        expert_bonus = 0.3
    else:
        expert_bonus = 0.0

    # 5. Consistency check (similar corrections on other songs)
    consistency_bonus = check_consistency_pattern(correction)

    # Final score
    confidence = (
        vote_confidence * 0.6 +
        rep_weight +
        expert_bonus +
        consistency_bonus -
        time_penalty
    )

    return max(0.0, min(1.0, confidence))  # clamp to [0, 1]


def wilson_score_interval(positive, total, confidence=0.95):
    """
    Wilson score interval (lower bound).
    More robust than simple positive/total ratio.
    """
    if total == 0:
        return 0
    z = 1.96  # 95% confidence
    phat = positive / total
    denominator = 1 + z**2 / total
    numerator = phat + z**2 / (2 * total) - z * (
        (phat * (1 - phat) + z**2 / (4 * total)) / total
    ) ** 0.5
    return numerator / denominator
```

### Approval Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Submits Correction                                 │
│    Status: pending                                          │
│    Confidence: 0.0 (no votes yet)                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Community Votes                                          │
│    • Upvote (+1): Agree with correction                     │
│    • Downvote (-1): Disagree                                │
│    • Confidence score recalculated on each vote             │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    │               │
            Confidence > 0.8    Confidence < 0.3
                    │               │
                    ↓               ↓
┌─────────────────────────┐  ┌─────────────────────────┐
│ 3a. Auto-Approve        │  │ 3b. Auto-Reject         │
│    Status: approved     │  │    Status: rejected     │
│    Applied automatically│  │    Hidden from users    │
└─────────────────────────┘  └─────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Expert Review (Optional)                                 │
│    • Triggered for popular songs                            │
│    • Or conflicting corrections                             │
│    • Expert can override community vote                     │
│    • Adds +0.3 confidence boost                             │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Applied to Users                                         │
│    • Approved corrections shown by default                  │
│    • Users can view original or corrected version           │
│    • "Community verified" badge displayed                   │
└─────────────────────────────────────────────────────────────┘
```

### Conflict Resolution

When multiple users suggest different corrections for the same position:

```python
def detect_conflict(new_correction):
    """Detect if new correction conflicts with existing ones."""
    existing = corrections.filter(
        source_url=new_correction.source_url,
        position=new_correction.position,
        status__in=['pending', 'approved']
    )

    if existing and existing.corrected_value != new_correction.corrected_value:
        return create_conflict(existing, new_correction)

def resolve_conflict(conflict):
    """Resolve conflict between competing corrections."""
    corrections = conflict.correction_ids

    # Method 1: Highest confidence wins
    winner = max(corrections, key=lambda c: c.confidence_score)

    if winner.confidence_score > 0.8:
        return approve_correction(winner, 'voting')

    # Method 2: Expert review required
    if any(c.confidence_score > 0.5 for c in corrections):
        request_expert_review(conflict)
        return 'pending_expert'

    # Method 3: Keep all pending if no clear winner
    return 'no_resolution'
```

## Reputation System

### Reputation Points

```python
REPUTATION_EVENTS = {
    'correction_submitted': 5,           # Submit any correction
    'correction_approved': 20,           # Correction approved by community
    'correction_approved_expert': 50,    # Correction approved by expert
    'upvote_received': 2,                # Someone upvotes your correction
    'downvote_received': -1,             # Someone downvotes your correction
    'correction_rejected': -5,           # Correction rejected
    'expert_review_completed': 10,       # Complete an expert review
    'first_contribution': 10,            # Bonus for first contribution
    'streak_7_days': 15,                 # Submit corrections 7 days in a row
    'milestone_100_contributions': 100,  # 100th contribution bonus
}

def update_reputation(user_id, event_type, correction_id=None):
    points = REPUTATION_EVENTS[event_type]

    reputation_events.create(
        user_id=user_id,
        event_type=event_type,
        points=points,
        related_correction_id=correction_id
    )

    user = users.get(id=user_id)
    user.reputation_score += points
    user.save()

    check_for_expert_promotion(user)
```

### Expert Promotion

```python
def check_for_expert_promotion(user):
    """Promote user to expert status based on contributions."""
    if user.is_expert:
        return

    criteria = [
        user.reputation_score >= 500,
        user.total_contributions >= 50,
        user.accepted_contributions >= 40,
        (user.accepted_contributions / user.total_contributions) >= 0.8
    ]

    if all(criteria):
        user.is_expert = True
        user.save()
        notify_user_expert_promotion(user)
```

## API Endpoints

### Submit Correction

```python
@router.post("/corrections")
async def submit_correction(
    correction: CorrectionCreate,
    current_user: User = Depends(get_current_user)
):
    """Submit a new correction for a song."""
    # Validate correction data
    validate_correction(correction)

    # Check for conflicts
    conflict = detect_conflict(correction)

    # Create correction record
    new_correction = corrections.create(
        user_id=current_user.id,
        **correction.dict(),
        status='pending',
        confidence_score=0.0
    )

    # Update reputation
    update_reputation(current_user.id, 'correction_submitted', new_correction.id)

    if conflict:
        return {
            "correction_id": new_correction.id,
            "status": "conflict_detected",
            "conflict_id": conflict.id,
            "message": "Your correction conflicts with existing ones. Community will vote."
        }

    return {
        "correction_id": new_correction.id,
        "status": "pending",
        "message": "Correction submitted for community review"
    }
```

### Vote on Correction

```python
@router.post("/corrections/{correction_id}/vote")
async def vote_correction(
    correction_id: UUID,
    vote: int,  # +1 or -1
    current_user: User = Depends(get_current_user)
):
    """Vote on a pending correction."""
    correction = corrections.get(id=correction_id)

    if not correction:
        raise HTTPException(404, "Correction not found")

    if correction.user_id == current_user.id:
        raise HTTPException(400, "Cannot vote on your own correction")

    # Record vote (upsert)
    correction_votes.upsert(
        correction_id=correction_id,
        user_id=current_user.id,
        vote=vote
    )

    # Recalculate net votes and confidence
    recalculate_correction_confidence(correction)

    # Update submitter reputation
    if vote == 1:
        update_reputation(correction.user_id, 'upvote_received', correction_id)
    else:
        update_reputation(correction.user_id, 'downvote_received', correction_id)

    # Check for auto-approval/rejection
    if correction.confidence_score > 0.8:
        approve_correction(correction, 'automated')
    elif correction.confidence_score < 0.3:
        reject_correction(correction, 'low_confidence')

    return {
        "vote_recorded": True,
        "new_confidence": correction.confidence_score,
        "status": correction.status
    }
```

### Get Corrections for Song

```python
@router.get("/corrections/song")
async def get_song_corrections(
    url: str,
    include_pending: bool = False,
    current_user: Optional[User] = None
):
    """Get all corrections for a song URL."""
    query = corrections.filter(source_url=url)

    if not include_pending:
        query = query.filter(status='approved')

    # Include user's own pending corrections
    if current_user:
        query = query.filter(
            Q(status='approved') | Q(user_id=current_user.id)
        )

    corrections_list = query.order_by('-confidence_score')

    return {
        "url": url,
        "corrections": [serialize_correction(c) for c in corrections_list],
        "total": len(corrections_list)
    }
```

### Expert Review

```python
@router.post("/corrections/{correction_id}/expert-review")
async def expert_review(
    correction_id: UUID,
    verdict: str,  # 'approve', 'reject', 'request_changes'
    comments: Optional[str],
    current_user: User = Depends(require_expert)
):
    """Expert reviews a correction."""
    correction = corrections.get(id=correction_id)

    # Create review record
    expert_reviews.create(
        correction_id=correction_id,
        expert_id=current_user.id,
        verdict=verdict,
        comments=comments
    )

    # Apply verdict
    if verdict == 'approve':
        correction.status = 'approved'
        correction.confidence_score = max(correction.confidence_score, 0.9)
        correction.approved_by = current_user.id
        update_reputation(correction.user_id, 'correction_approved_expert', correction_id)
    elif verdict == 'reject':
        correction.status = 'rejected'
        correction.rejection_reason = comments

    correction.save()

    # Expert gets reputation
    update_reputation(current_user.id, 'expert_review_completed', correction_id)

    return {"review_recorded": True, "new_status": correction.status}
```

## Frontend Features

### Correction Submission UI

```typescript
// CorrectionSubmitForm.tsx
interface SubmitCorrectionProps {
  songUrl: string;
  originalChord: string;
  position: ChordPosition;
}

function CorrectionSubmitForm({ songUrl, originalChord, position }: SubmitCorrectionProps) {
  const [correctedChord, setCorrectedChord] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    const correction = {
      type: 'chord_symbol',
      source_url: songUrl,
      position: position,
      original_value: originalChord,
      corrected_value: correctedChord,
      user_note: note
    };

    const result = await api.submitCorrection(correction);

    if (result.status === 'conflict_detected') {
      showConflictDialog(result.conflict_id);
    } else {
      showSuccess('Correction submitted for community review!');
    }
  };

  return (
    <div className="correction-form">
      <label>Original: {originalChord}</label>
      <input
        value={correctedChord}
        onChange={(e) => setCorrectedChord(e.target.value)}
        placeholder="Enter corrected chord"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why is this correct? (optional)"
      />
      <button onClick={handleSubmit}>Submit Correction</button>
    </div>
  );
}
```

### Voting UI

```typescript
// CorrectionVoteButton.tsx
function CorrectionVoteButton({ correction, onVoted }: Props) {
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);

  const handleVote = async (vote: 1 | -1) => {
    await api.voteCorrection(correction.id, vote);
    setUserVote(vote);
    onVoted();
  };

  return (
    <div className="vote-buttons">
      <button
        onClick={() => handleVote(1)}
        className={userVote === 1 ? 'active' : ''}
      >
        👍 {correction.upvotes}
      </button>
      <button
        onClick={() => handleVote(-1)}
        className={userVote === -1 ? 'active' : ''}
      >
        👎 {correction.downvotes}
      </button>
      <span className="confidence">
        {Math.round(correction.confidence_score * 100)}% confidence
      </span>
    </div>
  );
}
```

### Community Corrections Display

```typescript
// CommunityCorrectionBadge.tsx
function CommunityCorrectionBadge({ chord, corrections }: Props) {
  const approvedCorrection = corrections.find(c => c.status === 'approved');

  if (!approvedCorrection) return null;

  return (
    <span className="chord-with-correction">
      <span className="original-chord strikethrough">{chord.original}</span>
      <span className="corrected-chord">{approvedCorrection.corrected_value}</span>
      <span className="correction-badge" title="Community verified">
        ✓ {Math.round(approvedCorrection.confidence_score * 100)}%
      </span>
    </span>
  );
}
```

## Implementation Phases

### Phase 7.1: Foundation (2-3 weeks)

**Goal**: Set up database, authentication, and basic API

**Tasks**:
- [ ] Database schema creation
- [ ] User authentication (OAuth, email)
- [ ] Basic user profile and reputation
- [ ] API endpoints for CRUD corrections
- [ ] Frontend auth integration

**Deliverables**:
- Users can create accounts
- Users can submit corrections (stored in DB)
- API returns corrections for a song

### Phase 7.2: Voting System (2 weeks)

**Goal**: Enable community voting and confidence scoring

**Tasks**:
- [ ] Vote submission API
- [ ] Wilson score confidence calculation
- [ ] Real-time confidence updates
- [ ] Voting UI components
- [ ] Vote change tracking

**Deliverables**:
- Users can upvote/downvote corrections
- Confidence scores displayed
- High-confidence corrections highlighted

### Phase 7.3: Auto-Approval (1 week)

**Goal**: Automatically approve/reject based on confidence

**Tasks**:
- [ ] Auto-approval threshold (0.8)
- [ ] Auto-rejection threshold (0.3)
- [ ] Status change notifications
- [ ] Reputation updates on approval
- [ ] Applied corrections display

**Deliverables**:
- Corrections auto-approve at 80% confidence
- Approved corrections shown by default
- Users see "Community verified" badge

### Phase 7.4: Expert Review (2 weeks)

**Goal**: Expert verification and quality assurance

**Tasks**:
- [ ] Expert promotion logic (500+ rep)
- [ ] Expert review dashboard
- [ ] Expert verdict API
- [ ] Expert review UI
- [ ] Expert badge display

**Deliverables**:
- High-reputation users promoted to experts
- Experts can approve/reject corrections
- Expert reviews boost confidence by 30%

### Phase 7.5: Conflict Resolution (1-2 weeks)

**Goal**: Handle competing corrections intelligently

**Tasks**:
- [ ] Conflict detection logic
- [ ] Conflict resolution UI (side-by-side)
- [ ] Vote on competing options
- [ ] Expert arbitration for ties
- [ ] Conflict history tracking

**Deliverables**:
- Users see when corrections conflict
- Can vote on preferred option
- System resolves conflicts automatically or via expert

### Phase 7.6: Reputation & Gamification (1 week)

**Goal**: Incentivize quality contributions

**Tasks**:
- [ ] Reputation leaderboard
- [ ] Achievement badges (first correction, 100 corrections, etc.)
- [ ] Contribution streaks
- [ ] Weekly top contributors
- [ ] Reputation-based privileges

**Deliverables**:
- Users see reputation score
- Leaderboard page
- Badges displayed on profile
- Streaks tracked and rewarded

### Phase 7.7: Analytics & Monitoring (1 week)

**Goal**: Track system health and quality

**Tasks**:
- [ ] Correction approval rate dashboard
- [ ] Average confidence score metrics
- [ ] User engagement tracking
- [ ] Popular corrections report
- [ ] Quality improvement over time graph

**Deliverables**:
- Admin dashboard with metrics
- Identify low-quality songs
- Track system effectiveness

## Success Metrics

### Quantitative

- **Coverage**: % of Hebrew songs with corrections (target: 50%+)
- **Approval Rate**: % of submitted corrections approved (target: 70%+)
- **Confidence**: Average confidence score (target: 0.85+)
- **User Engagement**: Active correctors per week (target: 50+)
- **Accuracy**: % improvement vs original (target: 15%+)

### Qualitative

- **User Satisfaction**: Survey feedback on correction quality
- **Expert Consensus**: Agreement between expert reviews
- **Community Trust**: Users trust community corrections
- **Reduced Complaints**: Fewer reports of inaccurate chords

## Security & Abuse Prevention

### Spam Detection

```python
def is_likely_spam(correction, user):
    """Detect and prevent spam corrections."""
    # Rate limiting: max 10 corrections per hour
    recent_count = corrections.filter(
        user_id=user.id,
        created_at__gt=now() - timedelta(hours=1)
    ).count()

    if recent_count > 10:
        return True, "Rate limit exceeded"

    # Duplicate detection: same correction on multiple songs
    duplicate_count = corrections.filter(
        user_id=user.id,
        corrected_value=correction.corrected_value,
        created_at__gt=now() - timedelta(minutes=5)
    ).count()

    if duplicate_count > 5:
        return True, "Duplicate spam detected"

    # Low-reputation user with many rejections
    if user.reputation_score < 0:
        return True, "Negative reputation"

    return False, None
```

### Vote Manipulation

```python
def detect_vote_manipulation(correction_id):
    """Detect suspicious voting patterns."""
    votes = correction_votes.filter(correction_id=correction_id)

    # Same IP address multiple votes
    ips = [v.user.last_ip for v in votes]
    if len(ips) != len(set(ips)):
        flag_for_review(correction_id, "Duplicate IPs")

    # Newly created accounts voting together
    new_accounts = [v.user for v in votes if v.user.created_at > now() - timedelta(days=7)]
    if len(new_accounts) > 3:
        flag_for_review(correction_id, "Coordinated new accounts")

    # Reputation laundering (low-rep users voting each other up)
    low_rep_voters = [v.user for v in votes if v.user.reputation_score < 50]
    if len(low_rep_voters) > 5:
        flag_for_review(correction_id, "Low-reputation coordination")
```

## Conclusion

The Community Corrections system transforms Caspian from a single-user tool into a collaborative platform. By leveraging community wisdom and expert verification, we can:

1. **Improve Quality**: Crowdsource accuracy for Hebrew songs without ratings
2. **Build Trust**: Confidence scores and expert reviews ensure reliability
3. **Engage Users**: Reputation and gamification incentivize contributions
4. **Scale Gracefully**: Automated approval handles high volume
5. **Maintain Standards**: Expert review and abuse prevention ensure quality

**Timeline**: Phases 7.1 - 7.7 over 3-4 months

**Dependencies**: Phase 2 local corrections provide foundation and user training

**Launch Strategy**: Beta with invite-only experts → Public launch → Marketing
