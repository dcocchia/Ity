(function () {
  type TaskStatus = 'planned' | 'active' | 'blocked' | 'done';
  type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
  type NoticeTone = 'info' | 'success' | 'error';
  type AccentName = 'sunrise' | 'ocean' | 'fern';

  interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  }

  interface Person {
    id: string;
    name: string;
    role: string;
    initials: string;
  }

  interface ChecklistItem {
    id: string;
    label: string;
    done: boolean;
  }

  interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    ownerId: string;
    dueDate: string;
    tags: string[];
    checklist: ChecklistItem[];
    createdAt: string;
    updatedAt: string;
    lastStatusAt: string;
  }

  interface Note {
    id: string;
    title: string;
    body: string;
    relatedTaskIds: string[];
    createdAt: string;
    updatedAt: string;
  }

  interface ActivityEntry {
    id: string;
    kind: string;
    message: string;
    createdAt: string;
  }

  interface WorkspaceMeta {
    name: string;
    version: number;
    bulletinHtml: string;
    updatedAt: string;
  }

  interface WorkspaceSettings {
    defaultOwnerId: string;
    accent: AccentName;
    reportTitle: string;
  }

  interface WorkspaceData {
    meta: WorkspaceMeta;
    people: Person[];
    tasks: Task[];
    notes: Note[];
    activity: ActivityEntry[];
    settings: WorkspaceSettings;
  }

  interface UIPreferences {
    taskQuery: string;
    statusFilter: string;
    ownerFilter: string;
    includeDone: boolean;
    noteQuery: string;
  }

  interface CreateAppOptions {
    target?: string | Element;
    base?: string;
    storageKey?: string;
    storage?: StorageLike;
    initialData?: WorkspaceData;
    latencyMs?: number;
    time?: () => number;
    sanitizer?: (value: string) => string;
    modules?: {
      createQueryClient: (options?: Record<string, unknown>) => any;
      query: (client: any, key: any, loader: any, options?: Record<string, unknown>) => any;
      mutation: (client: any, handler: any, options?: Record<string, unknown>) => any;
      createFormKit: (initialValue: Record<string, unknown>, options?: Record<string, unknown>) => any;
    };
  }

  interface TaskFormInput {
    id?: string;
    title: string;
    description: string;
    ownerId: string;
    priority: TaskPriority;
    dueDate: string;
    tags: string[];
    checklistText: string;
  }

  interface NoteFormInput {
    id?: string;
    title: string;
    body: string;
    relatedTaskIds: string[];
  }

  interface SettingsInput {
    name: string;
    defaultOwnerId: string;
    accent: AccentName;
    reportTitle: string;
    bulletinHtml: string;
  }

  interface TaskDraft {
    taskId: string;
    title: string;
    description: string;
    ownerId: string;
    priority: TaskPriority;
    dueDate: string;
    tags: string;
    checklist: Array<{ label: string }>;
  }

  interface NoteDraft {
    noteId: string;
    title: string;
    body: string;
    relatedTaskIds: string[];
  }

  interface SettingsDraft {
    name: string;
    defaultOwnerId: string;
    accent: AccentName;
    reportTitle: string;
    bulletinHtml: string;
  }

  interface MutationResult {
    workspace: WorkspaceData;
    notice: string;
    navigateTo?: string;
  }

  interface Repository {
    loadWorkspace(signal?: AbortSignal): Promise<WorkspaceData>;
    saveTask(input: TaskFormInput): Promise<MutationResult>;
    cycleTaskStatus(taskId: string): Promise<MutationResult>;
    toggleChecklist(taskId: string, itemId: string): Promise<MutationResult>;
    deleteTask(taskId: string): Promise<MutationResult>;
    saveNote(input: NoteFormInput): Promise<MutationResult>;
    deleteNote(noteId: string): Promise<MutationResult>;
    saveSettings(input: SettingsInput): Promise<MutationResult>;
    importWorkspace(source: string): Promise<MutationResult>;
    resetWorkspace(): Promise<MutationResult>;
    readExport(): string;
  }

  interface OperationsWorkbenchApp {
    workspace: any;
    ui: any;
    router: any;
    actions: Record<string, any>;
    repository: Repository;
    dispose(): void;
  }

  const TASK_STATUS_ORDER: TaskStatus[] = ['planned', 'active', 'blocked', 'done'];
  const PRIORITY_ORDER: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };
  const ACCENTS: AccentName[] = ['sunrise', 'ocean', 'fern'];
  const EMPTY_PREFERENCES: UIPreferences = {
    taskQuery: '',
    statusFilter: 'all',
    ownerFilter: 'all',
    includeDone: true,
    noteQuery: ''
  };
  const WORKBENCH_COMPONENTS_KEY = '__ITY_WORKBENCH_COMPONENTS__';

  const browserWindow = (globalThis as any).window;

  function getNow(time?: () => number): number {
    return typeof time === 'function' ? time() : Date.now();
  }

  function toIso(time?: () => number): string {
    return new Date(getNow(time)).toISOString();
  }

  function addDays(days: number, time?: () => number): string {
    const date = new Date(getNow(time));
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function clampText(value: unknown, fallback = ''): string {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
  }

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isValidDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
  }

  function isValidIso(value: string): boolean {
    return !Number.isNaN(new Date(value).getTime());
  }

  function normalizeId(value: unknown, fallback: string): string {
    const text = clampText(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return text || fallback;
  }

  function createId(prefix: string, time?: () => number): string {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${getNow(time).toString(36)}-${random}`;
  }

  function splitLines(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseTags(value: string): string[] {
    return Array.from(new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    ));
  }

  function csv(value: string[] | undefined): string {
    return (value || []).join(', ');
  }

  function escapeHTML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function relativeTimeLabel(value: string, now: number): string {
    if (!isValidDateOnly(value) && !isValidIso(value)) return 'no date';
    const target = isValidDateOnly(value)
      ? new Date(`${value}T12:00:00Z`).getTime()
      : new Date(value).getTime();
    const deltaDays = Math.round((target - now) / 86400000);
    const formatterCtor = (globalThis as any).Intl?.RelativeTimeFormat;
    if (formatterCtor) {
      const formatter = new formatterCtor('en', { numeric: 'auto' });
      return formatter.format(deltaDays, 'day');
    }
    if (deltaDays === 0) return 'today';
    if (deltaDays > 0) return `in ${deltaDays} day${deltaDays === 1 ? '' : 's'}`;
    const distance = Math.abs(deltaDays);
    return `${distance} day${distance === 1 ? '' : 's'} ago`;
  }

  function formatLongDate(value: string): string {
    if (!isValidDateOnly(value) && !isValidIso(value)) return 'Unknown date';
    const date = isValidDateOnly(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  function formatDateTime(value: string): string {
    if (!isValidIso(value)) return 'Unknown time';
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function formatTimeOnly(value: string): string {
    if (!isValidIso(value)) return '--:--';
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function taskStatusLabel(status: TaskStatus): string {
    return ({
      planned: 'Planned',
      active: 'Active',
      blocked: 'Blocked',
      done: 'Done'
    } as Record<TaskStatus, string>)[status];
  }

  function priorityLabel(priority: TaskPriority): string {
    return ({
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low'
    } as Record<TaskPriority, string>)[priority];
  }

  function taskProgress(task: Task): string {
    if (!task.checklist.length) return 'No checklist';
    const complete = task.checklist.filter((item) => item.done).length;
    return `${complete}/${task.checklist.length} complete`;
  }

  function safeArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? value as T[] : [];
  }

  function cloneWorkspace<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  function deepEqualValue(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      for (let index = 0; index < left.length; index += 1) {
        if (!deepEqualValue(left[index], right[index])) return false;
      }
      return true;
    }
    if (isPlainObject(left) && isPlainObject(right)) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
        if (!deepEqualValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])) return false;
      }
      return true;
    }
    return false;
  }

  function reuseById<T extends { id: string }>(previous: T[], next: T[]): T[] {
    const previousById = new Map(previous.map((item) => [item.id, item] as const));
    const reused = next.map((item) => {
      const current = previousById.get(item.id);
      return current && deepEqualValue(current, item) ? current : item;
    });
    if (reused.length === previous.length && reused.every((item, index) => item === previous[index])) {
      return previous;
    }
    return reused;
  }

  function reuseWorkspace(previous: WorkspaceData | undefined, next: WorkspaceData): WorkspaceData {
    if (!previous) return next;
    const meta = deepEqualValue(previous.meta, next.meta) ? previous.meta : next.meta;
    const people = reuseById(previous.people, next.people);
    const tasks = reuseById(previous.tasks, next.tasks);
    const notes = reuseById(previous.notes, next.notes);
    const activity = reuseById(previous.activity, next.activity);
    const settings = deepEqualValue(previous.settings, next.settings) ? previous.settings : next.settings;

    if (
      meta === previous.meta
      && people === previous.people
      && tasks === previous.tasks
      && notes === previous.notes
      && activity === previous.activity
      && settings === previous.settings
    ) {
      return previous;
    }

    return {
      ...next,
      meta,
      people,
      tasks,
      notes,
      activity,
      settings
    };
  }

  function sortTasks(tasks: Task[]): Task[] {
    return tasks.slice().sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) return priorityDelta;
      if (left.status !== right.status) return TASK_STATUS_ORDER.indexOf(left.status) - TASK_STATUS_ORDER.indexOf(right.status);
      if (left.dueDate !== right.dueDate) return left.dueDate.localeCompare(right.dueDate);
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  function sortNotes(notes: Note[]): Note[] {
    return notes.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  function trimActivity(activity: ActivityEntry[]): ActivityEntry[] {
    return activity.slice(0, 18);
  }

  function createMemoryStorage(): StorageLike {
    const cache: Record<string, string> = {};
    return {
      getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
      },
      setItem(key: string, value: string): void {
        cache[key] = String(value);
      },
      removeItem(key: string): void {
        delete cache[key];
      }
    };
  }

  function resolveStorage(candidate?: StorageLike): StorageLike {
    if (candidate) return candidate;
    try {
      const storage = browserWindow?.localStorage;
      if (storage) {
        const probe = '__ity-workbench-probe__';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        return storage;
      }
    } catch (_error) {
      // Fall through to in-memory storage for restricted environments.
    }
    return createMemoryStorage();
  }

  function defaultWorkspace(time?: () => number): WorkspaceData {
    const updatedAt = toIso(time);
    return {
      meta: {
        name: 'Northstar Launch Control',
        version: 1,
        bulletinHtml: '<p><strong>Launch window:</strong> Customer beta opens Thursday. Review the blocker queue before 3 PM and post a short decision log to notes.</p><p><em>Tip:</em> Use the reports view before a stakeholder review so the export is already structured.</p>',
        updatedAt
      },
      people: [
        { id: 'ava', name: 'Ava Reynolds', role: 'Release Manager', initials: 'AR' },
        { id: 'milo', name: 'Milo Chen', role: 'Platform Lead', initials: 'MC' },
        { id: 'nina', name: 'Nina Patel', role: 'QA Lead', initials: 'NP' },
        { id: 'joel', name: 'Joel Kim', role: 'Support Ops', initials: 'JK' }
      ],
      tasks: sortTasks([
        {
          id: 'task-flags',
          title: 'Roll out feature flags to the beta cohort',
          description: 'Stage the release, verify defaults by region, and confirm every gate can be disabled without a redeploy.',
          status: 'active',
          priority: 'critical',
          ownerId: 'ava',
          dueDate: addDays(1, time),
          tags: ['release', 'feature-flags', 'beta'],
          checklist: [
            { id: 'flags-audit', label: 'Audit current flag defaults', done: true },
            { id: 'flags-regions', label: 'Verify region overrides', done: false },
            { id: 'flags-fallback', label: 'Run rollback drill', done: false }
          ],
          createdAt: updatedAt,
          updatedAt,
          lastStatusAt: updatedAt
        },
        {
          id: 'task-qc',
          title: 'Close the last QA signoff gaps',
          description: 'Validate keyboard navigation, dark data fixtures, and the mobile attachment upload path.',
          status: 'blocked',
          priority: 'high',
          ownerId: 'nina',
          dueDate: addDays(2, time),
          tags: ['qa', 'accessibility'],
          checklist: [
            { id: 'qc-nav', label: 'Keyboard pass', done: true },
            { id: 'qc-mobile', label: 'Mobile upload pass', done: false }
          ],
          createdAt: updatedAt,
          updatedAt,
          lastStatusAt: updatedAt
        },
        {
          id: 'task-briefing',
          title: 'Prepare the customer launch briefing',
          description: 'Summarize scope, risks, open questions, and support-call staffing for launch day.',
          status: 'planned',
          priority: 'medium',
          ownerId: 'joel',
          dueDate: addDays(3, time),
          tags: ['comms', 'support'],
          checklist: [
            { id: 'briefing-outline', label: 'Draft agenda', done: true },
            { id: 'briefing-qna', label: 'Collect Q&A answers', done: false }
          ],
          createdAt: updatedAt,
          updatedAt,
          lastStatusAt: updatedAt
        },
        {
          id: 'task-metrics',
          title: 'Snapshot baseline adoption metrics',
          description: 'Capture current conversion, activation, and churn baseline numbers before enabling the beta cohort.',
          status: 'done',
          priority: 'low',
          ownerId: 'milo',
          dueDate: addDays(-1, time),
          tags: ['analytics'],
          checklist: [
            { id: 'metrics-export', label: 'Export dashboard baseline', done: true }
          ],
          createdAt: updatedAt,
          updatedAt,
          lastStatusAt: updatedAt
        }
      ]),
      notes: sortNotes([
        {
          id: 'note-standup',
          title: 'Morning standup takeaways',
          body: 'QA still needs one mobile pass. Support wants a rollback note in the customer-facing runbook. No launch-date change yet.',
          relatedTaskIds: ['task-qc', 'task-briefing'],
          createdAt: updatedAt,
          updatedAt
        },
        {
          id: 'note-risk',
          title: 'Risk register summary',
          body: 'The primary risk is incomplete flag coverage for older accounts. Secondary risk is delayed customer comms if the support schedule shifts again.',
          relatedTaskIds: ['task-flags'],
          createdAt: updatedAt,
          updatedAt
        }
      ]),
      activity: trimActivity([
        { id: 'activity-1', kind: 'seed', message: 'Loaded the default launch workspace.', createdAt: updatedAt },
        { id: 'activity-2', kind: 'seed', message: 'Feature-flag rollout is already in progress.', createdAt: updatedAt }
      ]),
      settings: {
        defaultOwnerId: 'ava',
        accent: 'sunrise',
        reportTitle: 'Northstar Beta Release Report'
      }
    };
  }

  function sanitizeHTML(value: string): string {
    const doc = browserWindow?.document;
    if (!doc) return String(value).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    const template = doc.createElement('template');
    const blockedNavigationProtocols = /^(?:javascript|vbscript|data):/i;
    template.innerHTML = String(value);
    const blocked = template.content.querySelectorAll('script, style, iframe, object, embed, link, meta');
    blocked.forEach((node: Element) => node.remove());
    template.content.querySelectorAll('*').forEach((node: Element) => {
      Array.from(node.attributes).forEach((attribute: Attr) => {
        const name = attribute.name.toLowerCase();
        const rawValue = attribute.value.trim();
        if (name.startsWith('on')) {
          node.removeAttribute(attribute.name);
          return;
        }
        if (name === 'srcdoc') {
          node.removeAttribute(attribute.name);
          return;
        }
        if ((name === 'href' || name === 'action' || name === 'formaction' || name === 'xlink:href' || name === 'data') && blockedNavigationProtocols.test(rawValue)) {
          node.removeAttribute(attribute.name);
          return;
        }
        if ((name === 'src' || name === 'poster') && /^(?:javascript|vbscript):/i.test(rawValue)) {
          node.removeAttribute(attribute.name);
          return;
        }
        if (name === 'style') {
          node.removeAttribute(attribute.name);
        }
      });
    });
    return template.innerHTML;
  }

  function normalizePerson(value: unknown, fallbackId: string): Person | null {
    if (!isPlainObject(value)) return null;
    const name = clampText(value.name);
    if (!name) return null;
    const id = normalizeId(value.id, fallbackId);
    const initials = clampText(value.initials, name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase());
    return {
      id,
      name,
      role: clampText(value.role, 'Operator'),
      initials
    };
  }

  function normalizeChecklist(value: unknown, time?: () => number): ChecklistItem[] {
    return safeArray<Record<string, unknown>>(value)
      .map((item, index) => {
        if (!isPlainObject(item)) return null;
        const label = clampText(item.label);
        if (!label) return null;
        return {
          id: normalizeId(item.id, `checklist-${index}-${createId('item', time)}`),
          label,
          done: Boolean(item.done)
        };
      })
      .filter(Boolean) as ChecklistItem[];
  }

  function normalizeTask(
    value: unknown,
    defaultOwnerId: string,
    ownerIds: Set<string>,
    time?: () => number
  ): Task | null {
    if (!isPlainObject(value)) return null;
    const title = clampText(value.title);
    if (!title) return null;
    const createdAt = isValidIso(clampText(value.createdAt)) ? clampText(value.createdAt) : toIso(time);
    const updatedAt = isValidIso(clampText(value.updatedAt)) ? clampText(value.updatedAt) : createdAt;
    const lastStatusAt = isValidIso(clampText(value.lastStatusAt)) ? clampText(value.lastStatusAt) : updatedAt;
    const ownerId = normalizeId(value.ownerId, defaultOwnerId);
    const status = TASK_STATUS_ORDER.includes(value.status as TaskStatus) ? value.status as TaskStatus : 'planned';
    const priority = Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, value.priority as TaskPriority)
      ? value.priority as TaskPriority
      : 'medium';
    const dueDate = isValidDateOnly(clampText(value.dueDate)) ? clampText(value.dueDate) : addDays(2, time);
    return {
      id: normalizeId(value.id, createId('task', time)),
      title,
      description: clampText(value.description, 'No description yet.'),
      status,
      priority,
      ownerId: ownerIds.has(ownerId) ? ownerId : defaultOwnerId,
      dueDate,
      tags: safeArray<string>(value.tags).map((tag) => clampText(tag)).filter(Boolean),
      checklist: normalizeChecklist(value.checklist, time),
      createdAt,
      updatedAt,
      lastStatusAt
    };
  }

  function normalizeNote(value: unknown, taskIds: Set<string>, time?: () => number): Note | null {
    if (!isPlainObject(value)) return null;
    const title = clampText(value.title);
    const body = clampText(value.body);
    if (!title || !body) return null;
    const createdAt = isValidIso(clampText(value.createdAt)) ? clampText(value.createdAt) : toIso(time);
    const updatedAt = isValidIso(clampText(value.updatedAt)) ? clampText(value.updatedAt) : createdAt;
    return {
      id: normalizeId(value.id, createId('note', time)),
      title,
      body,
      relatedTaskIds: safeArray<string>(value.relatedTaskIds)
        .map((taskId) => normalizeId(taskId, ''))
        .filter((taskId) => taskIds.has(taskId)),
      createdAt,
      updatedAt
    };
  }

  function normalizeActivity(value: unknown, time?: () => number): ActivityEntry | null {
    if (!isPlainObject(value)) return null;
    const message = clampText(value.message);
    if (!message) return null;
    return {
      id: normalizeId(value.id, createId('activity', time)),
      kind: clampText(value.kind, 'event'),
      message,
      createdAt: isValidIso(clampText(value.createdAt)) ? clampText(value.createdAt) : toIso(time)
    };
  }

  function normalizeSettings(value: unknown, people: Person[], time?: () => number): WorkspaceSettings {
    const defaultOwnerId = people[0]?.id || 'owner';
    if (!isPlainObject(value)) {
      return {
        defaultOwnerId,
        accent: 'sunrise',
        reportTitle: 'Operations report'
      };
    }
    const ownerCandidate = normalizeId(value.defaultOwnerId, defaultOwnerId);
    const accentCandidate = clampText(value.accent, 'sunrise') as AccentName;
    const accent = ACCENTS.includes(accentCandidate) ? accentCandidate : 'sunrise';
    return {
      defaultOwnerId: people.some((person) => person.id === ownerCandidate) ? ownerCandidate : defaultOwnerId,
      accent,
      reportTitle: clampText(value.reportTitle, 'Operations report')
    };
  }

  function normalizeMeta(value: unknown, time?: () => number): WorkspaceMeta {
    if (!isPlainObject(value)) {
      return {
        name: 'Operations Workbench',
        version: 1,
        bulletinHtml: '',
        updatedAt: toIso(time)
      };
    }
    return {
      name: clampText(value.name, 'Operations Workbench'),
      version: typeof value.version === 'number' && Number.isFinite(value.version) ? Math.max(1, Math.floor(value.version)) : 1,
      bulletinHtml: typeof value.bulletinHtml === 'string' ? value.bulletinHtml : '',
      updatedAt: isValidIso(clampText(value.updatedAt)) ? clampText(value.updatedAt) : toIso(time)
    };
  }

  function normalizeWorkspace(value: unknown, time?: () => number): WorkspaceData {
    const fallback = defaultWorkspace(time);
    if (!isPlainObject(value)) return fallback;

    const people = safeArray<Record<string, unknown>>(value.people)
      .map((person, index) => normalizePerson(person, `person-${index + 1}`))
      .filter(Boolean) as Person[];
    const safePeople = people.length ? people : fallback.people;
    const settings = normalizeSettings(value.settings, safePeople, time);
    const ownerIds = new Set(safePeople.map((person) => person.id));

    const tasks = safeArray<Record<string, unknown>>(value.tasks)
      .map((task) => normalizeTask(task, settings.defaultOwnerId, ownerIds, time))
      .filter(Boolean) as Task[];
    const safeTasks = tasks.length ? sortTasks(tasks) : fallback.tasks;
    const taskIds = new Set(safeTasks.map((task) => task.id));

    const notes = safeArray<Record<string, unknown>>(value.notes)
      .map((note) => normalizeNote(note, taskIds, time))
      .filter(Boolean) as Note[];
    const activity = safeArray<Record<string, unknown>>(value.activity)
      .map((entry) => normalizeActivity(entry, time))
      .filter(Boolean) as ActivityEntry[];

    return {
      meta: normalizeMeta(value.meta, time),
      people: safePeople,
      tasks: safeTasks,
      notes: notes.length ? sortNotes(notes) : fallback.notes,
      activity: activity.length ? trimActivity(activity.sort((left, right) => right.createdAt.localeCompare(left.createdAt))) : fallback.activity,
      settings
    };
  }

  function parseChecklistText(value: string, previous: ChecklistItem[], time?: () => number): ChecklistItem[] {
    const previousByKey = new Map<string, ChecklistItem>();
    previous.forEach((item) => {
      previousByKey.set(item.label.trim().toLowerCase(), item);
    });
    return splitLines(value).map((line) => {
      const existing = previousByKey.get(line.toLowerCase());
      return existing
        ? { ...existing, label: line }
        : { id: createId('check', time), label: line, done: false };
    });
  }

  function pushActivity(workspace: WorkspaceData, kind: string, message: string, time?: () => number): void {
    workspace.activity = trimActivity([
      {
        id: createId('activity', time),
        kind,
        message,
        createdAt: toIso(time)
      },
      ...workspace.activity
    ]);
    workspace.meta.updatedAt = toIso(time);
  }

  function withDelay(ms: number, signal?: AbortSignal): Promise<void> {
    const duration = Math.max(0, ms);
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason || new Error('Aborted'));
        return;
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, duration);
      const onAbort = (): void => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(signal?.reason || new Error('Aborted'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  function createRepository(options: {
    storage: StorageLike;
    storageKey: string;
    seed?: WorkspaceData;
    latencyMs: number;
    time?: () => number;
  }): Repository {
    const { storage, storageKey, latencyMs } = options;
    const time = options.time;

    const readWorkspace = (): WorkspaceData => {
      const raw = storage.getItem(storageKey);
      if (!raw) {
        const initial = normalizeWorkspace(options.seed || defaultWorkspace(time), time);
        storage.setItem(storageKey, JSON.stringify(initial, null, 2));
        return cloneWorkspace(initial);
      }
      try {
        return normalizeWorkspace(JSON.parse(raw), time);
      } catch (_error) {
        throw new Error('Stored workspace data is invalid. Reset the example data from Settings to recover.');
      }
    };

    const writeWorkspace = (workspace: WorkspaceData): WorkspaceData => {
      const next = normalizeWorkspace(workspace, time);
      storage.setItem(storageKey, JSON.stringify(next, null, 2));
      return cloneWorkspace(next);
    };

    const requireTask = (workspace: WorkspaceData, taskId: string): Task => {
      const task = workspace.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error('That task no longer exists.');
      return task;
    };

    const requireNote = (workspace: WorkspaceData, noteId: string): Note => {
      const note = workspace.notes.find((item) => item.id === noteId);
      if (!note) throw new Error('That note no longer exists.');
      return note;
    };

    return {
      async loadWorkspace(signal?: AbortSignal): Promise<WorkspaceData> {
        await withDelay(latencyMs, signal);
        return cloneWorkspace(readWorkspace());
      },

      async saveTask(input: TaskFormInput): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const title = clampText(input.title);
        if (!title) throw new Error('Task title is required.');
        if (!workspace.people.some((person) => person.id === input.ownerId)) {
          throw new Error('Select a valid task owner.');
        }
        if (!isValidDateOnly(input.dueDate)) {
          throw new Error('Enter a valid due date.');
        }

        const index = input.id ? workspace.tasks.findIndex((task) => task.id === input.id) : -1;
        const previous = index >= 0 ? workspace.tasks[index] : undefined;
        const now = toIso(time);
        const nextTask: Task = {
          id: previous?.id || createId('task', time),
          title,
          description: clampText(input.description, 'No description yet.'),
          status: previous?.status || 'planned',
          priority: Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, input.priority) ? input.priority : 'medium',
          ownerId: input.ownerId,
          dueDate: input.dueDate,
          tags: input.tags,
          checklist: parseChecklistText(input.checklistText, previous?.checklist || [], time),
          createdAt: previous?.createdAt || now,
          updatedAt: now,
          lastStatusAt: previous?.lastStatusAt || now
        };

        if (previous) {
          workspace.tasks.splice(index, 1, nextTask);
          pushActivity(workspace, 'task-update', `Updated task: ${nextTask.title}`, time);
        } else {
          workspace.tasks.unshift(nextTask);
          pushActivity(workspace, 'task-create', `Created task: ${nextTask.title}`, time);
        }

        workspace.tasks = sortTasks(workspace.tasks);
        const next = writeWorkspace(workspace);
        return {
          workspace: next,
          notice: previous ? 'Task updated.' : 'Task created.',
          navigateTo: `/tasks/${nextTask.id}`
        };
      },

      async cycleTaskStatus(taskId: string): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const task = requireTask(workspace, taskId);
        const currentIndex = TASK_STATUS_ORDER.indexOf(task.status);
        task.status = TASK_STATUS_ORDER[(currentIndex + 1) % TASK_STATUS_ORDER.length];
        task.updatedAt = toIso(time);
        task.lastStatusAt = task.updatedAt;
        workspace.tasks = sortTasks(workspace.tasks);
        pushActivity(workspace, 'task-status', `${task.title} moved to ${taskStatusLabel(task.status)}.`, time);
        return {
          workspace: writeWorkspace(workspace),
          notice: `Task moved to ${taskStatusLabel(task.status)}.`
        };
      },

      async toggleChecklist(taskId: string, itemId: string): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const task = requireTask(workspace, taskId);
        const item = task.checklist.find((entry) => entry.id === itemId);
        if (!item) throw new Error('That checklist item no longer exists.');
        item.done = !item.done;
        task.updatedAt = toIso(time);
        pushActivity(workspace, 'task-checklist', `${task.title}: ${item.done ? 'completed' : 're-opened'} "${item.label}".`, time);
        return {
          workspace: writeWorkspace(workspace),
          notice: item.done ? 'Checklist item completed.' : 'Checklist item reopened.'
        };
      },

      async deleteTask(taskId: string): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const task = requireTask(workspace, taskId);
        workspace.tasks = workspace.tasks.filter((item) => item.id !== taskId);
        workspace.notes = workspace.notes.map((note) => ({
          ...note,
          relatedTaskIds: note.relatedTaskIds.filter((id) => id !== taskId)
        }));
        pushActivity(workspace, 'task-delete', `Deleted task: ${task.title}`, time);
        return {
          workspace: writeWorkspace(workspace),
          notice: 'Task deleted.',
          navigateTo: '/tasks'
        };
      },

      async saveNote(input: NoteFormInput): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const title = clampText(input.title);
        const body = clampText(input.body);
        if (!title) throw new Error('Note title is required.');
        if (!body) throw new Error('Note body is required.');
        const validTaskIds = new Set(workspace.tasks.map((task) => task.id));
        const relatedTaskIds = input.relatedTaskIds.filter((taskId) => validTaskIds.has(taskId));
        const index = input.id ? workspace.notes.findIndex((note) => note.id === input.id) : -1;
        const previous = index >= 0 ? workspace.notes[index] : undefined;
        const now = toIso(time);
        const nextNote: Note = {
          id: previous?.id || createId('note', time),
          title,
          body,
          relatedTaskIds,
          createdAt: previous?.createdAt || now,
          updatedAt: now
        };
        if (previous) {
          workspace.notes.splice(index, 1, nextNote);
          pushActivity(workspace, 'note-update', `Updated note: ${nextNote.title}`, time);
        } else {
          workspace.notes.unshift(nextNote);
          pushActivity(workspace, 'note-create', `Created note: ${nextNote.title}`, time);
        }
        workspace.notes = sortNotes(workspace.notes);
        return {
          workspace: writeWorkspace(workspace),
          notice: previous ? 'Note updated.' : 'Note created.'
        };
      },

      async deleteNote(noteId: string): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const note = requireNote(workspace, noteId);
        workspace.notes = workspace.notes.filter((item) => item.id !== noteId);
        pushActivity(workspace, 'note-delete', `Deleted note: ${note.title}`, time);
        return {
          workspace: writeWorkspace(workspace),
          notice: 'Note deleted.'
        };
      },

      async saveSettings(input: SettingsInput): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = readWorkspace();
        const name = clampText(input.name);
        if (!name) throw new Error('Workspace name is required.');
        if (!workspace.people.some((person) => person.id === input.defaultOwnerId)) {
          throw new Error('Select a valid default owner.');
        }
        workspace.meta.name = name;
        workspace.meta.bulletinHtml = input.bulletinHtml || '';
        workspace.settings.defaultOwnerId = input.defaultOwnerId;
        workspace.settings.accent = ACCENTS.includes(input.accent) ? input.accent : 'sunrise';
        workspace.settings.reportTitle = clampText(input.reportTitle, 'Operations report');
        pushActivity(workspace, 'settings', 'Saved workspace settings.', time);
        return {
          workspace: writeWorkspace(workspace),
          notice: 'Settings saved.'
        };
      },

      async importWorkspace(source: string): Promise<MutationResult> {
        await withDelay(latencyMs);
        let parsed: unknown;
        try {
          parsed = JSON.parse(source);
        } catch (_error) {
          throw new Error('Import JSON is invalid.');
        }
        const workspace = normalizeWorkspace(parsed, time);
        pushActivity(workspace, 'import', 'Imported workspace data.', time);
        return {
          workspace: writeWorkspace(workspace),
          notice: 'Workspace imported.'
        };
      },

      async resetWorkspace(): Promise<MutationResult> {
        await withDelay(latencyMs);
        const workspace = defaultWorkspace(time);
        pushActivity(workspace, 'reset', 'Reset the workspace back to the default data set.', time);
        return {
          workspace: writeWorkspace(workspace),
          notice: 'Example data reset.'
        };
      },

      readExport(): string {
        return JSON.stringify(readWorkspace(), null, 2);
      }
    };
  }

  function normalizeBasePath(value: string): string {
    const normalized = (value || '/').replace(/\/index\.html$/, '').replace(/\/+$/, '');
    return normalized || '';
  }

  function inferBasePath(explicit?: string): string {
    if (typeof explicit === 'string') return normalizeBasePath(explicit);
    const pathname = browserWindow?.location?.pathname || '/Examples/OperationsWorkbench';
    return normalizeBasePath(pathname);
  }

  function appHref(base: string, path: string): string {
    const parsed = new URL(path || '/', 'http://ity.local');
    const routePath = parsed.pathname === '/index.html' ? '/' : parsed.pathname;
    const normalizedBase = normalizeBasePath(base);
    const nextPath = normalizedBase
      ? `${normalizedBase}${routePath === '/' ? '' : routePath}`
      : routePath;
    return `${nextPath || '/'}${parsed.search}${parsed.hash}`;
  }

  function loadPreferences(storage: StorageLike, storageKey: string): UIPreferences {
    const raw = storage.getItem(`${storageKey}:prefs`);
    if (!raw) return { ...EMPTY_PREFERENCES };
    try {
      const parsed = JSON.parse(raw);
      return {
        taskQuery: clampText(parsed.taskQuery),
        statusFilter: clampText(parsed.statusFilter, 'all'),
        ownerFilter: clampText(parsed.ownerFilter, 'all'),
        includeDone: parsed.includeDone !== false,
        noteQuery: clampText(parsed.noteQuery)
      };
    } catch (_error) {
      return { ...EMPTY_PREFERENCES };
    }
  }

  function savePreferences(storage: StorageLike, storageKey: string, value: UIPreferences): void {
    storage.setItem(`${storageKey}:prefs`, JSON.stringify(value, null, 2));
  }

  function taskDraftFromTask(task: Task | null, workspaceData: WorkspaceData, time?: () => number): TaskDraft {
    if (!task) {
      return {
        taskId: '',
        title: '',
        description: '',
        ownerId: workspaceData.settings.defaultOwnerId,
        priority: 'medium',
        dueDate: addDays(2, time),
        tags: '',
        checklist: [{ label: '' }]
      };
    }
    return {
      taskId: task.id,
      title: task.title,
      description: task.description,
      ownerId: task.ownerId,
      priority: task.priority,
      dueDate: task.dueDate,
      tags: csv(task.tags),
      checklist: task.checklist.length
        ? task.checklist.map((item) => ({ label: item.label }))
        : [{ label: '' }]
    };
  }

  function noteDraftFromNote(note: Note | null): NoteDraft {
    if (!note) {
      return {
        noteId: '',
        title: '',
        body: '',
        relatedTaskIds: []
      };
    }
    return {
      noteId: note.id,
      title: note.title,
      body: note.body,
      relatedTaskIds: note.relatedTaskIds.slice()
    };
  }

  function settingsDraftFromWorkspace(workspaceData: WorkspaceData): SettingsDraft {
    return {
      name: workspaceData.meta.name,
      defaultOwnerId: workspaceData.settings.defaultOwnerId,
      accent: workspaceData.settings.accent,
      reportTitle: workspaceData.settings.reportTitle,
      bulletinHtml: workspaceData.meta.bulletinHtml
    };
  }

  function taskIdFromPath(path: string | undefined): string {
    const match = path?.match(/\/tasks\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function draftKey(value: unknown): string {
    try {
      return JSON.stringify(value) || '';
    } catch (_error) {
      return '';
    }
  }

  function ensureWorkbenchComponents(Ity: any): void {
    if (browserWindow?.[WORKBENCH_COMPONENTS_KEY]) return;

    Ity.component('ity-workbench-relative-time', {
      attrs: ['datetime'],
      shadow: true,
      styles: `
        time {
          color: #526274;
          display: inline-block;
          font-size: 0.9rem;
        }
      `,
      setup(ctx: any) {
        const datetime = ctx.attr('datetime');
        const now = Ity.signal(Date.now());
        let timer: any = null;

        ctx.onConnected(() => {
          now.set(Date.now());
          timer = setInterval(() => now.set(Date.now()), 60000);
        });
        ctx.onDisconnected(() => {
          if (timer) clearInterval(timer);
          timer = null;
        });

        return () => {
          const value = datetime() || '';
          return Ity.html`
            <time datetime=${value} title=${formatLongDate(value)}>
              ${relativeTimeLabel(value, now())}
            </time>
          `;
        };
      }
    });

    Ity.component('ity-workbench-metric', {
      attrs: ['label', 'value', 'hint', 'tone'],
      shadow: true,
      styles: `
        .metric {
          background: linear-gradient(160deg, #ffffff, #f4f0e8);
          border: 1px solid rgba(17, 24, 39, 0.08);
          border-radius: 22px;
          box-shadow: 0 18px 48px rgba(17, 24, 39, 0.08);
          display: grid;
          gap: 0.4rem;
          min-height: 9rem;
          padding: 1.15rem 1.2rem;
        }

        .metric[data-tone="active"] {
          background: linear-gradient(160deg, #fff4dc, #fff8ef);
        }

        .metric[data-tone="blocked"] {
          background: linear-gradient(160deg, #ffe9df, #fff7f2);
        }

        .metric[data-tone="done"] {
          background: linear-gradient(160deg, #e8fbef, #f6fffa);
        }

        .label {
          color: #526274;
          font-size: 0.85rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .value {
          color: #14213d;
          font-family: "Avenir Next", "Segoe UI", sans-serif;
          font-size: 2.3rem;
          font-weight: 700;
          line-height: 1;
        }

        .hint {
          color: #415366;
          font-size: 0.95rem;
        }
      `,
      setup(ctx: any) {
        const label = ctx.attr('label');
        const value = ctx.attr('value');
        const hint = ctx.attr('hint');
        const tone = ctx.attr('tone');

        return () => Ity.html`
          <article class="metric" data-tone=${tone() || 'default'}>
            <div class="label">${label() || 'Metric'}</div>
            <div class="value">${value() || '0'}</div>
            <div class="hint">${hint() || ''}</div>
          </article>
        `;
      }
    });

    Ity.component('ity-workbench-task-card', {
      props: ['task', 'owner', 'onAdvance'],
      shadow: true,
      styles: `
        .card {
          background: #ffffff;
          border: 1px solid rgba(17, 24, 39, 0.08);
          border-radius: 24px;
          box-shadow: 0 16px 44px rgba(15, 23, 42, 0.08);
          display: grid;
          gap: 0.9rem;
          padding: 1.15rem;
        }

        .top,
        .meta,
        .actions {
          align-items: center;
          display: flex;
          gap: 0.65rem;
          justify-content: space-between;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .chip,
        .status {
          background: #f2f4f7;
          border-radius: 999px;
          color: #38495a;
          display: inline-flex;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0.35rem 0.7rem;
        }

        .status[data-status="active"] {
          background: #fff3c6;
          color: #815400;
        }

        .status[data-status="blocked"] {
          background: #ffd8cf;
          color: #8b2e16;
        }

        .status[data-status="done"] {
          background: #dff7e7;
          color: #106b39;
        }

        .eyebrow {
          color: #526274;
          font-size: 0.82rem;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .title {
          color: #14213d;
          font-family: "Avenir Next", "Segoe UI", sans-serif;
          font-size: 1.15rem;
          font-weight: 700;
          margin: 0;
        }

        .description {
          color: #425466;
          margin: 0;
        }

        a,
        button {
          align-items: center;
          background: #14213d;
          border: 0;
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          justify-content: center;
          min-height: 2.4rem;
          padding: 0.65rem 0.95rem;
          text-decoration: none;
        }

        a.secondary {
          background: #eef2f7;
          color: #14213d;
        }
      `,
      setup(ctx: any) {
        const task = ctx.prop('task');
        const owner = ctx.prop('owner');
        const onAdvance = ctx.prop('onAdvance');
        const router = ctx.inject('router');

        return () => {
          const taskValue = task();
          const ownerValue = owner();
          const routerValue = router();
          if (!taskValue) {
            return Ity.html`<article class="card"><p>Task unavailable.</p></article>`;
          }
          return Ity.html`
            <article class="card">
              <div class="top">
                <p class="eyebrow">${priorityLabel(taskValue.priority)}</p>
                <span class="status" data-status=${taskValue.status}>${taskStatusLabel(taskValue.status)}</span>
              </div>
              <h3 class="title">${taskValue.title}</h3>
              <p class="description">${taskValue.description}</p>
              <div class="meta">
                <span>${ownerValue?.name || 'Unassigned'}</span>
                <ity-workbench-relative-time datetime=${taskValue.dueDate}></ity-workbench-relative-time>
              </div>
              <div class="chips">
                ${Ity.repeat(taskValue.tags, (tag: string) => tag, (tag: string) => Ity.html`<span class="chip">${tag}</span>`)}
              </div>
              <div class="meta">
                <span>${taskProgress(taskValue)}</span>
                <span>${ownerValue?.name || 'Unassigned'}</span>
              </div>
              <div class="actions">
                <a class="secondary owbTaskCard__open" bind=${routerValue ? routerValue.link(`/tasks/${taskValue.id}`) : { href: '#' }}>Open task</a>
                <button class="owbTaskCard__cycle" ?disabled=${typeof onAdvance() !== 'function'} @click=${() => onAdvance()?.()}>
                  Advance status
                </button>
              </div>
            </article>
          `;
        };
      }
    });

    if (browserWindow) {
      browserWindow[WORKBENCH_COMPONENTS_KEY] = true;
    }
  }

  function createOperationsWorkbenchApp(Ity: any, input: string | Element | CreateAppOptions = '#operationsWorkbenchApp'): OperationsWorkbenchApp {
    ensureWorkbenchComponents(Ity);

    const options = (typeof input === 'string' || ((input as Element | undefined)?.nodeType))
      ? { target: input as string | Element }
      : ((input as CreateAppOptions) || {});

    const target = options.target || '#operationsWorkbenchApp';
    const base = inferBasePath(options.base);
    const storageKey = options.storageKey || 'ity-operations-workbench';
    const storage = resolveStorage(options.storage);
    const repository = createRepository({
      storage,
      storageKey,
      seed: options.initialData,
      latencyMs: typeof options.latencyMs === 'number' ? options.latencyMs : 35,
      time: options.time
    });
    const modules = options.modules;
    if (!modules?.createQueryClient || !modules?.query || !modules?.mutation || !modules?.createFormKit) {
      throw new Error('Operations Workbench requires the Ity v3 companion modules: query and forms.');
    }
    const queryClient = modules.createQueryClient({ gcTime: 120000 });
    const appScope = Ity.createScope({ name: 'operations-workbench' });
    appScope.provide('repository', repository);
    appScope.provide('queryClient', queryClient);
    const htmlConfig = Ity.createConfig({
      sanitizeHTML: options.sanitizer || sanitizeHTML
    });

    const preferences = loadPreferences(storage, storageKey);
    const ui = Ity.store({
      page: 'dashboard',
      activeTaskId: '',
      editingNoteId: '',
      taskQuery: preferences.taskQuery,
      statusFilter: preferences.statusFilter,
      ownerFilter: preferences.ownerFilter,
      includeDone: preferences.includeDone,
      noteQuery: preferences.noteQuery,
      noticeMessage: '',
      noticeTone: 'info' as NoticeTone,
      noticeToken: 0,
      reportMode: 'preview'
    });

    const workspace = modules.query(queryClient, 'workspace', async ({ signal }: { signal: AbortSignal }) => repository.loadWorkspace(signal), {
      initialValue: undefined,
      keepPrevious: true,
      name: 'workbench.workspace'
    });

    const taskState = modules.createFormKit({
      taskId: '',
      title: '',
      description: '',
      ownerId: '',
      priority: 'medium' as TaskPriority,
      dueDate: '',
      tags: '',
      checklist: [{ label: '' }]
    }, {
      validators: {
        title(value: string) {
          return value.trim() ? null : 'Task title is required.';
        },
        ownerId(value: string) {
          return value ? null : 'Select an owner.';
        },
        dueDate(value: string) {
          return isValidDateOnly(value) ? null : 'Enter a valid due date.';
        },
        'checklist.0.label'(value: string, values: TaskDraft) {
          const hasChecklist = values.checklist.some((item) => clampText(item.label));
          return hasChecklist ? null : 'Add at least one checklist item.';
        }
      }
    });

    const noteState = Ity.formState({
      noteId: '',
      title: '',
      body: '',
      relatedTaskIds: [] as string[]
    }, {
      validators: {
        title(value: string) {
          return value.trim() ? null : 'Note title is required.';
        },
        body(value: string) {
          return value.trim() ? null : 'Note body is required.';
        }
      }
    });

    const settingsState = Ity.formState({
      name: '',
      defaultOwnerId: '',
      accent: 'sunrise' as AccentName,
      reportTitle: '',
      bulletinHtml: ''
    }, {
      validators: {
        name(value: string) {
          return value.trim() ? null : 'Workspace name is required.';
        },
        defaultOwnerId(value: string) {
          return value ? null : 'Select a default owner.';
        },
        reportTitle(value: string) {
          return value.trim() ? null : 'Report title is required.';
        }
      }
    });

    const importState = Ity.formState({
      importText: ''
    }, {
      validators: {
        importText(value: string) {
          return value.trim() ? null : 'Paste workspace JSON to import.';
        }
      }
    });
    const taskChecklist = taskState.array('checklist');

    const setNotice = (message: string, tone: NoticeTone = 'info'): void => {
      Ity.batch(() => {
        ui.noticeMessage = message;
        ui.noticeTone = tone;
        ui.noticeToken = ui.noticeToken + 1;
      });
    };

    const messageFromError = (error: unknown): string => error instanceof Error ? error.message : 'Something went wrong.';
    const onMutationError = (error: unknown): void => setNotice(messageFromError(error), 'error');

    const router = new Ity.Router({
      autoStart: false,
      base,
      transition: true,
      scope: appScope,
      name: 'operations-workbench',
      notFound: () => {
        ui.page = 'not-found';
        ui.activeTaskId = '';
      }
    });
    appScope.provide('router', router);

    const activatePage = (page: string, activeTaskId = ''): (() => void) => {
      ui.page = page;
      ui.activeTaskId = activeTaskId;
      return () => {
        if (page.indexOf('task') === 0) ui.activeTaskId = '';
      };
    };

    router.add('/', () => activatePage('dashboard'));
    router.add('/index.html', () => activatePage('dashboard'));
    router.add('/tasks', () => activatePage('tasks'));
    router.add('/tasks/new', () => activatePage('task-create'));
    router.add('/tasks/:id', (params: Record<string, string>) => activatePage('task-detail', params.id));
    router.add('/notes', () => activatePage('notes'));
    router.add('/reports', () => activatePage('reports'));
    router.add('/settings', () => activatePage('settings'));

    const applyMutation = (result: MutationResult): MutationResult => {
      const nextWorkspace = reuseWorkspace(workspace.data() || undefined, result.workspace);
      Ity.batch(() => {
        workspace.mutate(nextWorkspace);
        setNotice(result.notice, 'success');
      });
      if (result.navigateTo) router.navigate(result.navigateTo);
      return {
        ...result,
        workspace: nextWorkspace
      };
    };

    const cycleTask = modules.mutation(queryClient, async (taskId: string) => applyMutation(await repository.cycleTaskStatus(taskId)), {
      onError: onMutationError
    });
    const toggleChecklist = modules.mutation(queryClient, async (taskId: string, itemId: string) => applyMutation(await repository.toggleChecklist(taskId, itemId)), {
      onError: onMutationError
    });
    const deleteTask = modules.mutation(queryClient, async (taskId: string) => applyMutation(await repository.deleteTask(taskId)), {
      onError: onMutationError
    });
    const deleteNote = modules.mutation(queryClient, async (noteId: string) => applyMutation(await repository.deleteNote(noteId)), {
      onError: onMutationError
    });
    const resetWorkspaceAction = modules.mutation(queryClient, async () => {
      const result = applyMutation(await repository.resetWorkspace());
      taskState.reset(taskDraftFromTask(null, result.workspace, options.time));
      noteState.reset(noteDraftFromNote(null));
      settingsState.reset(settingsDraftFromWorkspace(result.workspace));
      importState.reset({ importText: '' });
      return result;
    }, {
      onError: onMutationError
    });

    const taskSubmit = taskState.submit(async (values: TaskDraft) => {
      const checklistText = values.checklist
        .map((item) => clampText(item.label))
        .filter(Boolean)
        .join('\n');
      const result = applyMutation(await repository.saveTask({
        id: clampText(values.taskId),
        title: values.title,
        description: values.description,
        ownerId: values.ownerId,
        priority: values.priority,
        dueDate: values.dueDate,
        tags: parseTags(values.tags),
        checklistText
      }));
      const savedTask = result.workspace.tasks.find((task) => task.id === taskIdFromPath(result.navigateTo) || task.id === values.taskId) || null;
      taskState.reset(taskDraftFromTask(savedTask, result.workspace, options.time));
      return result;
    }, {
      onError: onMutationError
    });

    const noteSubmit = noteState.submit(async (values: NoteDraft) => {
      const result = applyMutation(await repository.saveNote({
        id: clampText(values.noteId),
        title: values.title,
        body: values.body,
        relatedTaskIds: values.relatedTaskIds.slice()
      }));
      const savedNote = result.workspace.notes.find((note) => note.id === values.noteId || note.title === values.title) || null;
      noteState.reset(noteDraftFromNote(savedNote));
      ui.editingNoteId = savedNote?.id || '';
      return result;
    }, {
      onError: onMutationError
    });

    const settingsSubmit = settingsState.submit(async (values: SettingsDraft) => {
      const result = applyMutation(await repository.saveSettings({
        name: values.name,
        defaultOwnerId: values.defaultOwnerId,
        accent: values.accent,
        reportTitle: values.reportTitle,
        bulletinHtml: values.bulletinHtml
      }));
      settingsState.reset(settingsDraftFromWorkspace(result.workspace));
      return result;
    }, {
      onError: onMutationError
    });

    const importSubmit = importState.submit(async (values: { importText: string }) => {
      const result = applyMutation(await repository.importWorkspace(values.importText));
      taskState.reset(taskDraftFromTask(null, result.workspace, options.time));
      noteState.reset(noteDraftFromNote(null));
      settingsState.reset(settingsDraftFromWorkspace(result.workspace));
      importState.reset({ importText: '' });
      ui.editingNoteId = '';
      return result;
    }, {
      onError: onMutationError
    });

    const dashboardTasks = Ity.computed(() => {
      const data = workspace.data();
      if (!data) return [];
      return sortTasks(data.tasks.filter((task: Task) => task.status !== 'done')).slice(0, 3);
    });

    const filteredTasks = Ity.computed(() => {
      const data = workspace.data();
      if (!data) return [];
      const query = ui.taskQuery.trim().toLowerCase();
      return sortTasks(data.tasks).filter((task: Task) => {
        if (!ui.includeDone && task.status === 'done') return false;
        if (ui.statusFilter !== 'all' && task.status !== ui.statusFilter) return false;
        if (ui.ownerFilter !== 'all' && task.ownerId !== ui.ownerFilter) return false;
        if (!query) return true;
        const haystack = `${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase();
        return haystack.includes(query);
      });
    });

    const selectedTask = Ity.computed(() => {
      const data = workspace.data();
      if (!data || !ui.activeTaskId) return null;
      return data.tasks.find((task: Task) => task.id === ui.activeTaskId) || null;
    });

    const filteredNotes = Ity.computed(() => {
      const data = workspace.data();
      if (!data) return [];
      const query = ui.noteQuery.trim().toLowerCase();
      return sortNotes(data.notes).filter((note: Note) => {
        if (!query) return true;
        return `${note.title} ${note.body}`.toLowerCase().includes(query);
      });
    });

    const selectedNote = Ity.computed(() => {
      const data = workspace.data();
      if (!data || !ui.editingNoteId) return null;
      return data.notes.find((note: Note) => note.id === ui.editingNoteId) || null;
    });

    const metrics = Ity.computed(() => {
      const data = workspace.data();
      if (!data) return { total: 0, active: 0, blocked: 0, done: 0 };
      return {
        total: data.tasks.length,
        active: data.tasks.filter((task: Task) => task.status === 'active').length,
        blocked: data.tasks.filter((task: Task) => task.status === 'blocked').length,
        done: data.tasks.filter((task: Task) => task.status === 'done').length
      };
    });

    const reportMarkup = Ity.computed(() => {
      const data = workspace.data();
      if (!data) return '';
      return Ity.renderToString(() => Ity.html`
        <article class="owbReportDocument">
          <header>
            <p>${data.meta.name}</p>
            <h1>${data.settings.reportTitle}</h1>
            <p>Generated ${formatDateTime(toIso(options.time))}</p>
          </header>
          <section>
            <h2>Summary</h2>
            <ul>
              <li>Total tasks: ${String(metrics().total)}</li>
              <li>Active tasks: ${String(metrics().active)}</li>
              <li>Blocked tasks: ${String(metrics().blocked)}</li>
              <li>Completed tasks: ${String(metrics().done)}</li>
            </ul>
          </section>
          <section>
            <h2>Operator Bulletin</h2>
            ${Ity.unsafeHTML(data.meta.bulletinHtml || '<p>No bulletin set.</p>')}
          </section>
          <section>
            <h2>Task Ledger</h2>
            <ol>
              ${sortTasks(data.tasks).map((task: Task) => Ity.html`
                <li>
                  <strong>${task.title}</strong> · ${taskStatusLabel(task.status)} · ${priorityLabel(task.priority)} · Due ${task.dueDate}
                </li>
              `)}
            </ol>
          </section>
          <section>
            <h2>Recent Notes</h2>
            <ul>
              ${sortNotes(data.notes).slice(0, 5).map((note: Note) => Ity.html`
                <li><strong>${note.title}</strong>: ${note.body}</li>
              `)}
            </ul>
          </section>
        </article>
      `, { config: htmlConfig });
    });

    const runtimeEvents = Ity.signal([] as Array<{ type: string; name?: string; time: string }>);
    const runtimeStop = Ity.observeRuntime((event: { type: string; name?: string; timestamp: number }) => {
      const nextEntry: { type: string; name?: string; time: string } = {
        type: event.type,
        name: event.name,
        time: formatTimeOnly(new Date(event.timestamp).toISOString())
      };
      runtimeEvents.update((items: Array<{ type: string; name?: string; time: string }>) => [nextEntry].concat(items).slice(0, 10));
    });

    const preferenceStop = ui.$subscribe((value: typeof ui) => {
      savePreferences(storage, storageKey, {
        taskQuery: value.taskQuery,
        statusFilter: value.statusFilter,
        ownerFilter: value.ownerFilter,
        includeDone: value.includeDone,
        noteQuery: value.noteQuery
      });
    }, { immediate: true });

    const noticeStop = Ity.effect((onCleanup: (cleanup: () => void) => void) => {
      const token = ui.noticeToken;
      if (!ui.noticeMessage) return;
      const timer = setTimeout(() => {
        if (ui.noticeToken === token) ui.noticeMessage = '';
      }, 3200);
      onCleanup(() => clearTimeout(timer));
    });

    const resolveOwner = (workspaceData: WorkspaceData, ownerId: string): Person | undefined => {
      return workspaceData.people.find((person) => person.id === ownerId);
    };

    const cycleTaskHandlerCache = new Map<string, () => void>();
    const getCycleTaskHandler = (taskId: string): (() => void) => {
      let handler = cycleTaskHandlerCache.get(taskId);
      if (!handler) {
        const nextHandler = cycleTask.with(taskId) as () => void;
        cycleTaskHandlerCache.set(taskId, nextHandler);
        handler = nextHandler;
      }
      return handler as () => void;
    };

    const cycleTaskHandlerStop = Ity.effect(() => {
      const data = workspace.data();
      if (!data) {
        cycleTaskHandlerCache.clear();
        return;
      }
      const validTaskIds = new Set(data.tasks.map((task: Task) => task.id));
      for (const taskId of Array.from(cycleTaskHandlerCache.keys())) {
        if (!validTaskIds.has(taskId)) cycleTaskHandlerCache.delete(taskId);
      }
    });

    let lastTaskDraftContext = '';
    let lastTaskDraftValue = '';
    const taskDraftStop = Ity.effect(() => {
      const data = workspace.data();
      const page = ui.page;
      const task = selectedTask();
      const taskIsDirty = taskState.dirty();
      if (!data) return;
      if (page === 'task-create') {
        const nextDraft = taskDraftFromTask(null, data, options.time);
        const nextContext = 'create';
        const nextValue = draftKey(nextDraft);
        if (lastTaskDraftContext !== nextContext || lastTaskDraftValue !== nextValue) {
          lastTaskDraftContext = nextContext;
          lastTaskDraftValue = nextValue;
          Ity.untrack(() => taskState.reset(nextDraft));
          taskSubmit.action.reset();
        }
        return;
      }
      if (page === 'task-detail') {
        const nextContext = `detail:${task?.id || 'missing'}`;
        const nextDraft = taskDraftFromTask(task, data, options.time);
        const nextValue = draftKey(nextDraft);
        if ((lastTaskDraftContext !== nextContext || lastTaskDraftValue !== nextValue) && (!taskIsDirty || lastTaskDraftContext !== nextContext)) {
          lastTaskDraftContext = nextContext;
          lastTaskDraftValue = nextValue;
          Ity.untrack(() => taskState.reset(nextDraft));
          taskSubmit.action.reset();
        }
        return;
      }
      lastTaskDraftContext = '';
      lastTaskDraftValue = '';
    });

    let lastNoteDraftContext = '';
    let lastNoteDraftValue = '';
    const noteDraftStop = Ity.effect(() => {
      const data = workspace.data();
      const noteIsDirty = noteState.dirty();
      if (!data || ui.page !== 'notes') {
        lastNoteDraftContext = '';
        lastNoteDraftValue = '';
        return;
      }
      const nextContext = ui.editingNoteId || 'new';
      const nextDraft = noteDraftFromNote(selectedNote());
      const nextValue = draftKey(nextDraft);
      if ((lastNoteDraftContext !== nextContext || lastNoteDraftValue !== nextValue) && (!noteIsDirty || lastNoteDraftContext !== nextContext)) {
        lastNoteDraftContext = nextContext;
        lastNoteDraftValue = nextValue;
        Ity.untrack(() => noteState.reset(nextDraft));
        noteSubmit.action.reset();
      }
    });

    let lastSettingsDraftValue = '';
    const settingsDraftStop = Ity.effect(() => {
      const data = workspace.data();
      const settingsIsDirty = settingsState.dirty();
      if (!data) return;
      const nextDraft = settingsDraftFromWorkspace(data);
      const nextValue = draftKey(nextDraft);
      if (nextValue !== lastSettingsDraftValue && !settingsIsDirty) {
        lastSettingsDraftValue = nextValue;
        Ity.untrack(() => settingsState.reset(nextDraft));
      }
    });

    const renderMetricCards = () => Ity.html`
      <div class="owbMetrics">
        <ity-workbench-metric label="Total Tasks" value=${String(metrics().total)} hint="Everything currently tracked" tone="default"></ity-workbench-metric>
        <ity-workbench-metric label="Active" value=${String(metrics().active)} hint="Execution work happening now" tone="active"></ity-workbench-metric>
        <ity-workbench-metric label="Blocked" value=${String(metrics().blocked)} hint="Needs a decision or dependency" tone="blocked"></ity-workbench-metric>
        <ity-workbench-metric label="Done" value=${String(metrics().done)} hint="Closed and shipped items" tone="done"></ity-workbench-metric>
      </div>
    `;

    const renderTaskCard = (task: Task, workspaceData: WorkspaceData) => Ity.html`
      <ity-workbench-task-card
        .task=${task}
        .owner=${resolveOwner(workspaceData, task.ownerId) || null}
        .onAdvance=${getCycleTaskHandler(task.id)}
      ></ity-workbench-task-card>
    `;

    const renderDashboard = (workspaceData: WorkspaceData) => Ity.html`
      <section class="owbPanel">
        <div class="owbSectionHeading">
          <div>
            <p class="owbKicker">Workspace</p>
            <h2>Launch snapshot</h2>
          </div>
          <a class="owbGhostButton owbGhostButton--link" bind=${router.link('/reports')}>Open report</a>
        </div>
        ${renderMetricCards()}
      </section>

      <section class="owbGrid owbGrid--dashboard">
        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Bulletin</p>
              <h2>Operator briefing</h2>
            </div>
            <a class="owbInlineLink" bind=${router.link('/settings')}>Edit settings</a>
          </div>
          <div class="owbRichText">${Ity.unsafeHTML(workspaceData.meta.bulletinHtml || '<p>No bulletin set.</p>')}</div>
        </article>

        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Priority Queue</p>
              <h2>Closest launch work</h2>
            </div>
            <a class="owbInlineLink" bind=${router.link('/tasks')}>See all tasks</a>
          </div>
          <div class="owbTaskStack">
            ${Ity.repeat(dashboardTasks(), (task: Task) => task.id, (task: Task) => renderTaskCard(task, workspaceData))}
          </div>
        </article>
      </section>

      <section class="owbGrid owbGrid--dashboard">
        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Recent Notes</p>
              <h2>Team memory</h2>
            </div>
            <a class="owbInlineLink" bind=${router.link('/notes')}>Manage notes</a>
          </div>
          <ul class="owbList">
            ${Ity.repeat(workspaceData.notes.slice(0, 3), (note: Note) => note.id, (note: Note) => Ity.html`
              <li class="owbListItem">
                <div>
                  <strong>${note.title}</strong>
                  <p>${note.body}</p>
                </div>
                <span>${formatDateTime(note.updatedAt)}</span>
              </li>
            `)}
          </ul>
        </article>

        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Activity</p>
              <h2>Change feed</h2>
            </div>
          </div>
          <ul class="owbList">
            ${Ity.repeat(workspaceData.activity.slice(0, 6), (entry: ActivityEntry) => entry.id, (entry: ActivityEntry) => Ity.html`
              <li class="owbListItem">
                <div>
                  <strong>${entry.message}</strong>
                  <p>${entry.kind}</p>
                </div>
                <span>${formatDateTime(entry.createdAt)}</span>
              </li>
            `)}
          </ul>
          <div class="owbSectionHeading" style=${{ marginTop: '1rem' }}>
            <div>
              <p class="owbKicker">Runtime Feed</p>
              <h2>Kernel activity</h2>
            </div>
          </div>
          <ul class="owbList">
            ${Ity.repeat(runtimeEvents(), (entry: { type: string; time: string }, index: number) => `${entry.time}:${entry.type}:${index}`, (entry: { type: string; name?: string; time: string }) => Ity.html`
              <li class="owbListItem">
                <div>
                  <strong>${entry.type}</strong>
                  <p>${entry.name || 'Unnamed'}</p>
                </div>
                <span>${entry.time}</span>
              </li>
            `)}
          </ul>
        </article>
      </section>
    `;

    const renderTaskForm = (workspaceData: WorkspaceData, heading: string) => Ity.html`
      <section class="owbPanel">
        <div class="owbSectionHeading">
          <div>
            <p class="owbKicker">${heading === 'New task' ? 'Create' : 'Edit'}</p>
            <h2>${heading}</h2>
          </div>
        </div>
        <form class="owbForm" @submit=${taskSubmit.handleSubmit}>
          <input type="hidden" bind=${taskState.bind('taskId')}>
          <label>
            <span>Task title</span>
            <input id="taskTitle" placeholder="Prepare stakeholder checklist" bind=${taskState.bind('title')}>
          </label>
          <label>
            <span>Description</span>
            <textarea rows="5" placeholder="Describe the job, constraints, and outcome." bind=${taskState.bind('description', { type: 'textarea' })}></textarea>
          </label>
          <div class="owbFormGrid">
            <label>
              <span>Owner</span>
              <select bind=${taskState.bind('ownerId', { type: 'select' })}>
                ${workspaceData.people.map((person: Person) => Ity.html`<option value=${person.id}>${person.name}</option>`)}
              </select>
            </label>
            <label>
              <span>Priority</span>
              <select bind=${taskState.bind('priority', { type: 'select' })}>
                ${Object.keys(PRIORITY_ORDER).map((priority) => Ity.html`
                  <option value=${priority}>${priorityLabel(priority as TaskPriority)}</option>
                `)}
              </select>
            </label>
            <label>
              <span>Due date</span>
              <input type="date" bind=${taskState.bind('dueDate')}>
            </label>
          </div>
          <label>
            <span>Tags</span>
            <input placeholder="release, risk, qa" bind=${taskState.bind('tags')}>
          </label>
          <fieldset>
            <legend>Checklist</legend>
            <div class="owbTaskStack">
	              ${Ity.repeat(taskChecklist.keys().map((key: string, index: number) => ({ key, index })), (item: { key: string }) => item.key, (item: { key: string; index: number }) => Ity.html`
	                <div class="owbChecklistItem" key=${item.key}>
	                  <input
	                    placeholder="Audit rollout defaults"
	                    bind=${taskState.bind(`checklist.${item.index}.label`)}
	                  >
	                  <button
	                    class="owbGhostButton"
	                    type="button"
	                    ?disabled=${taskChecklist.items().length <= 1}
	                    @click=${(event: Event) => {
	                      taskState.sync(event);
	                      taskChecklist.remove(item.index);
	                    }}
	                  >
	                    Remove
	                  </button>
	                </div>
	              `)}
	            </div>
	            <div class="owbInlineActions">
	              <button class="owbGhostButton" type="button" @click=${(event: Event) => {
	                taskState.sync(event);
	                taskChecklist.push({ label: '' });
	              }}>Add item</button>
	            </div>
	          </fieldset>
          <div class="owbFormActions">
            <button class="owbPrimaryButton" ?disabled=${taskSubmit.pending()}>
              ${taskSubmit.pending() ? 'Saving…' : heading === 'New task' ? 'Create task' : 'Save task'}
            </button>
            <a class="owbGhostButton owbGhostButton--link" bind=${router.link('/tasks')}>Back to task board</a>
          </div>
          ${(taskState.field('title').touched() && taskState.field('title').error()) && Ity.html`<p class="owbInlineError" role="alert">${taskState.field('title').error()}</p>`}
          ${(taskState.field('dueDate').touched() && taskState.field('dueDate').error()) && Ity.html`<p class="owbInlineError" role="alert">${taskState.field('dueDate').error()}</p>`}
          ${(taskState.field('checklist.0.label').touched() && taskState.field('checklist.0.label').error()) && Ity.html`<p class="owbInlineError" role="alert">${taskState.field('checklist.0.label').error()}</p>`}
          ${taskSubmit.error() && Ity.html`<p class="owbInlineError" role="alert">${messageFromError(taskSubmit.error())}</p>`}
        </form>
      </section>
    `;

    const renderTasksPage = (workspaceData: WorkspaceData) => Ity.html`
      <section class="owbGrid owbGrid--tasks">
        <aside class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Filters</p>
              <h2>Task board</h2>
            </div>
            <a class="owbInlineLink" bind=${router.link('/tasks/new')}>New task</a>
          </div>
          <label>
            <span>Search</span>
            <input
              class="owbFilterInput"
              .value=${ui.taskQuery}
              @input=${(event: Event) => { ui.taskQuery = (event.target as HTMLInputElement).value; }}
              placeholder="Search title, description, or tags"
            >
          </label>
          <label>
            <span>Status</span>
            <select @change=${(event: Event) => { ui.statusFilter = (event.target as HTMLSelectElement).value; }}>
              <option value="all" ?selected=${ui.statusFilter === 'all'}>All statuses</option>
              ${TASK_STATUS_ORDER.map((status) => Ity.html`
                <option value=${status} ?selected=${ui.statusFilter === status}>${taskStatusLabel(status)}</option>
              `)}
            </select>
          </label>
          <label>
            <span>Owner</span>
            <select @change=${(event: Event) => { ui.ownerFilter = (event.target as HTMLSelectElement).value; }}>
              <option value="all" ?selected=${ui.ownerFilter === 'all'}>All owners</option>
              ${workspaceData.people.map((person: Person) => Ity.html`
                <option value=${person.id} ?selected=${ui.ownerFilter === person.id}>${person.name}</option>
              `)}
            </select>
          </label>
          <label class="owbCheckboxRow">
            <input type="checkbox" .checked=${ui.includeDone} @change=${(event: Event) => { ui.includeDone = (event.target as HTMLInputElement).checked; }}>
            <span>Include completed tasks</span>
          </label>
        </aside>
        <section class="owbTaskStack">
          ${filteredTasks().length
            ? Ity.repeat(filteredTasks(), (task: Task) => task.id, (task: Task) => renderTaskCard(task, workspaceData))
            : Ity.html`<article class="owbEmptyState"><h3>No tasks match the current filters.</h3><p>Change the filters or create a new task.</p></article>`}
        </section>
      </section>
    `;

    const renderTaskDetail = (workspaceData: WorkspaceData, task: Task | null) => {
      if (!task) {
        return Ity.html`
          <article class="owbEmptyState">
            <h2>Task not found</h2>
            <p>The URL points to a task that no longer exists in this local workspace.</p>
            <a class="owbPrimaryButton owbPrimaryButton--link" bind=${router.link('/tasks')}>Back to task board</a>
          </article>
        `;
      }
      const owner = resolveOwner(workspaceData, task.ownerId);
      return Ity.html`
        <section class="owbGrid owbGrid--detail">
          <article class="owbPanel">
            <div class="owbSectionHeading">
              <div>
                <p class="owbKicker">Task detail</p>
                <h2>${task.title}</h2>
              </div>
              <div class="owbInlineActions">
                <button class="owbGhostButton" ?disabled=${cycleTask.pending()} @click=${cycleTask.with(task.id)}>Advance status</button>
                <button class="owbDangerButton" ?disabled=${deleteTask.pending()} @click=${deleteTask.with(task.id)}>Delete task</button>
              </div>
            </div>
            <dl class="owbStatRow">
              <div><dt>Status</dt><dd>${taskStatusLabel(task.status)}</dd></div>
              <div><dt>Priority</dt><dd>${priorityLabel(task.priority)}</dd></div>
              <div><dt>Owner</dt><dd>${owner?.name || 'Unassigned'}</dd></div>
              <div><dt>Due</dt><dd>${formatLongDate(task.dueDate)}</dd></div>
            </dl>
            <p class="owbBodyText">${task.description}</p>
            <div class="owbChecklist">
              <div class="owbSectionHeading">
                <div>
                  <p class="owbKicker">Execution</p>
                  <h3>Checklist</h3>
                </div>
              </div>
              ${task.checklist.length
                ? Ity.repeat(task.checklist, (item: ChecklistItem) => item.id, (item: ChecklistItem) => Ity.html`
                  <label class="owbChecklistItem">
                    <input type="checkbox" .checked=${item.done} @change=${toggleChecklist.with(task.id, item.id)}>
                    <span>${item.label}</span>
                  </label>
                `)
                : Ity.html`<p class="owbBodyText">No checklist items yet. Add them in the editor.</p>`}
            </div>
          </article>
          ${renderTaskForm(workspaceData, 'Update task')}
        </section>
      `;
    };

    const renderNotesPage = (workspaceData: WorkspaceData) => {
      const note = selectedNote();
      return Ity.html`
        <section class="owbGrid owbGrid--notes">
          <aside class="owbPanel">
            <div class="owbSectionHeading">
              <div>
                <p class="owbKicker">Notes</p>
                <h2>Operational memory</h2>
              </div>
              <button class="owbGhostButton" @click=${() => { ui.editingNoteId = ''; }}>New note</button>
            </div>
            <label>
              <span>Search</span>
              <input
                .value=${ui.noteQuery}
                @input=${(event: Event) => { ui.noteQuery = (event.target as HTMLInputElement).value; }}
                placeholder="Filter notes"
              >
            </label>
            <div class="owbNoteList">
              ${Ity.repeat(filteredNotes(), (entry: Note) => entry.id, (entry: Note) => Ity.html`
                <button class="owbNoteCard" @click=${() => { ui.editingNoteId = entry.id; }}>
                  <strong>${entry.title}</strong>
                  <span>${formatDateTime(entry.updatedAt)}</span>
                  <p>${entry.body}</p>
                </button>
              `)}
            </div>
          </aside>
          <article class="owbPanel">
            <div class="owbSectionHeading">
              <div>
                <p class="owbKicker">Editor</p>
                <h2>${note ? 'Update note' : 'Capture a new note'}</h2>
              </div>
              ${note && Ity.html`<button class="owbDangerButton" ?disabled=${deleteNote.pending()} @click=${deleteNote.with(note.id)}>Delete note</button>`}
            </div>
            <form class="owbForm" @submit=${noteSubmit.handleSubmit}>
              <input type="hidden" bind=${noteState.bind('noteId')}>
              <label>
                <span>Title</span>
                <input placeholder="Decision log for launch day" bind=${noteState.bind('title')}>
              </label>
              <label>
                <span>Body</span>
                <textarea rows="9" placeholder="Capture what changed, why it matters, and what should happen next." bind=${noteState.bind('body', { type: 'textarea' })}></textarea>
              </label>
              <fieldset class="owbFieldset">
                <legend>Related tasks</legend>
                <div class="owbCheckboxGrid">
                  ${workspaceData.tasks.map((task: Task) => Ity.html`
                    <label class="owbCheckboxRow">
                      <input type="checkbox" bind=${noteState.bind('relatedTaskIds', { type: 'checkbox', value: task.id })}>
                      <span>${task.title}</span>
                    </label>
                  `)}
                </div>
              </fieldset>
              <div class="owbFormActions">
                <button class="owbPrimaryButton" ?disabled=${noteSubmit.pending()}>
                  ${noteSubmit.pending() ? 'Saving…' : note ? 'Save note' : 'Create note'}
                </button>
              </div>
              ${(noteState.touched.title && noteState.errors.title) && Ity.html`<p class="owbInlineError" role="alert">${noteState.errors.title}</p>`}
              ${(noteState.touched.body && noteState.errors.body) && Ity.html`<p class="owbInlineError" role="alert">${noteState.errors.body}</p>`}
              ${noteSubmit.error() && Ity.html`<p class="owbInlineError" role="alert">${messageFromError(noteSubmit.error())}</p>`}
            </form>
          </article>
        </section>
      `;
    };

    const renderReportsPage = () => Ity.html`
      <section class="owbGrid owbGrid--reports">
        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Report Preview</p>
              <h2>Shareable status output</h2>
            </div>
            <div class="owbInlineActions">
              <button class="owbGhostButton" @click=${() => { ui.reportMode = 'preview'; }}>Preview</button>
              <button class="owbGhostButton" @click=${() => { ui.reportMode = 'markup'; }}>Markup</button>
            </div>
          </div>
          ${ui.reportMode === 'preview'
            ? Ity.html`<div class="owbReportPreview">${Ity.unsafeHTML(reportMarkup())}</div>`
            : Ity.html`<textarea class="owbCodeBlock" readonly rows="24">${reportMarkup()}</textarea>`}
        </article>
      </section>
    `;

    const renderSettingsPage = (workspaceData: WorkspaceData) => Ity.html`
      <section class="owbGrid owbGrid--settings">
        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Settings</p>
              <h2>Workspace configuration</h2>
            </div>
          </div>
          <form class="owbForm" @submit=${settingsSubmit.handleSubmit}>
            <label>
              <span>Workspace name</span>
              <input bind=${settingsState.bind('name')}>
            </label>
            <div class="owbFormGrid">
              <label>
                <span>Default owner</span>
                <select bind=${settingsState.bind('defaultOwnerId', { type: 'select' })}>
                  ${workspaceData.people.map((person: Person) => Ity.html`<option value=${person.id}>${person.name}</option>`)}
                </select>
              </label>
              <label>
                <span>Accent</span>
                <select bind=${settingsState.bind('accent', { type: 'select' })}>
                  ${ACCENTS.map((accent) => Ity.html`<option value=${accent}>${accent}</option>`)}
                </select>
              </label>
              <label>
                <span>Report title</span>
                <input bind=${settingsState.bind('reportTitle')}>
              </label>
            </div>
            <label>
              <span>Bulletin HTML</span>
              <textarea rows="8" bind=${settingsState.bind('bulletinHtml', { type: 'textarea' })}></textarea>
            </label>
            <div class="owbPreviewPanel">
              <h3>Sanitized bulletin preview</h3>
              <div class="owbRichText">${Ity.unsafeHTML(settingsState.values.bulletinHtml || '<p>No bulletin set.</p>')}</div>
            </div>
            <div class="owbFormActions">
              <button class="owbPrimaryButton" ?disabled=${settingsSubmit.pending()}>
                ${settingsSubmit.pending() ? 'Saving…' : 'Save settings'}
              </button>
              <button class="owbDangerButton" type="button" ?disabled=${resetWorkspaceAction.pending()} @click=${resetWorkspaceAction.run}>
                Reset example data
              </button>
            </div>
            ${settingsSubmit.error() && Ity.html`<p class="owbInlineError" role="alert">${messageFromError(settingsSubmit.error())}</p>`}
          </form>
        </article>
        <article class="owbPanel">
          <div class="owbSectionHeading">
            <div>
              <p class="owbKicker">Data portability</p>
              <h2>Import or export the workspace</h2>
            </div>
          </div>
          <label>
            <span>Export JSON</span>
            <textarea class="owbCodeBlock" readonly rows="16">${repository.readExport()}</textarea>
          </label>
          <form class="owbForm" @submit=${importSubmit.handleSubmit}>
            <label>
              <span>Import JSON</span>
              <textarea
                name="importText"
                rows="12"
                placeholder='{"meta":{"name":"Imported workspace"}}'
                bind=${importState.bind('importText', { type: 'textarea' })}
              ></textarea>
            </label>
            <div class="owbFormActions">
              <button class="owbPrimaryButton" ?disabled=${importSubmit.pending()}>
                ${importSubmit.pending() ? 'Importing…' : 'Import workspace'}
              </button>
            </div>
            ${(importState.touched.importText && importState.errors.importText) && Ity.html`<p class="owbInlineError" role="alert">${importState.errors.importText}</p>`}
            ${importSubmit.error() && Ity.html`<p class="owbInlineError" role="alert">${messageFromError(importSubmit.error())}</p>`}
          </form>
        </article>
      </section>
    `;

    const renderNotFound = () => Ity.html`
      <article class="owbEmptyState">
        <h2>Route not found</h2>
        <p>The requested page is outside this example’s router map.</p>
        <a class="owbPrimaryButton owbPrimaryButton--link" bind=${router.link('/')}>Go to dashboard</a>
      </article>
    `;

    const renderErrorState = () => Ity.html`
      <article class="owbEmptyState">
        <h2>Workspace load failed</h2>
        <p role="alert">${messageFromError(workspace.error())}</p>
        <div class="owbInlineActions">
          <button class="owbPrimaryButton" @click=${() => workspace.refresh()}>Retry load</button>
          <button class="owbDangerButton" @click=${resetWorkspaceAction.run}>Reset example data</button>
        </div>
      </article>
    `;

    const disposeRender = Ity.render(() => {
      const data = workspace.data();
      const page = ui.page;
      const current = router.current();
      const isBusy = workspace.loading();

      return Ity.html`
        <div class="owbRoot" data-accent=${data?.settings.accent || 'sunrise'}>
          <header class="owbShellHeader">
            <div>
              <p class="owbEyebrow">Major V2.2 Example</p>
              <h1>${data?.meta.name || 'Operations Workbench'}</h1>
              <p class="owbShellSubhead">Local-first release control built on signals, resources, typed form state, actions, Web Components, the router, and string rendering.</p>
            </div>
            <div class="owbHeaderActions">
              <span class="owbSyncBadge" data-status=${workspace.status()}>
                ${workspace.loading() ? 'Refreshing…' : workspace.status() === 'error' ? 'Needs attention' : 'Synced locally'}
              </span>
              <button class="owbGhostButton" ?disabled=${workspace.loading()} @click=${() => workspace.refresh()}>Refresh</button>
            </div>
          </header>

          <nav class="owbNav">
            ${[
              ['/', 'Overview'],
              ['/tasks', 'Tasks'],
              ['/notes', 'Notes'],
              ['/reports', 'Reports'],
              ['/settings', 'Settings']
            ].map(([path, label]) => Ity.html`
              <a
                bind=${router.link(path)}
                class=${{
                  owbNavLink: true,
                  'is-active': current?.path === path || (path === '/tasks' && page.indexOf('task') === 0)
                }}
              >
                ${label}
              </a>
            `)}
          </nav>

          ${ui.noticeMessage && Ity.html`
            <aside class="owbNotice" data-tone=${ui.noticeTone} role="status">
              ${ui.noticeMessage}
            </aside>
          `}

          <main class="owbMain" aria-busy=${String(isBusy)}>
            ${workspace.error() && !data
              ? renderErrorState()
              : !data
                ? Ity.html`<article class="owbEmptyState"><h2>Loading workspace…</h2><p>Bootstrapping the local-first data store and route state.</p></article>`
                : page === 'dashboard'
                  ? renderDashboard(data)
                  : page === 'tasks'
                    ? renderTasksPage(data)
                    : page === 'task-create'
                      ? renderTaskForm(data, 'New task')
                      : page === 'task-detail'
                        ? renderTaskDetail(data, selectedTask())
                        : page === 'notes'
                          ? renderNotesPage(data)
                          : page === 'reports'
                            ? renderReportsPage()
                            : page === 'settings'
                              ? renderSettingsPage(data)
                              : renderNotFound()}
          </main>
        </div>
      `;
    }, target, { config: htmlConfig, scope: appScope });

    router.start();

    return {
      workspace,
      ui,
      router,
      repository,
      actions: {
        cycleTask,
        toggleChecklist,
        deleteTask,
        deleteNote,
        resetWorkspace: resetWorkspaceAction,
        taskForm: taskSubmit,
        noteForm: noteSubmit,
        settingsForm: settingsSubmit,
        importForm: importSubmit
      },
      dispose(): void {
        router.stop();
        disposeRender();
        preferenceStop();
        noticeStop();
        runtimeStop();
        taskDraftStop();
        noteDraftStop();
        settingsDraftStop();
        cycleTaskHandlerStop();
      }
    };
  }

  if (browserWindow) {
    browserWindow.ItyExamples ||= {};
    browserWindow.ItyExamples.createOperationsWorkbenchApp = createOperationsWorkbenchApp;
    browserWindow.ItyExamples.createMemoryStorage = createMemoryStorage;
  }
})();
