import { useState } from "react";
import {
  useListRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  getListRulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

type RuleCondition = {
  field: "amount" | "merchantCategory" | "location" | "fraudScore" | "riskLevel";
  operator: "gt" | "lt" | "gte" | "lte" | "equals" | "not_equals" | "contains" | "in";
  value: string;
};

type RuleForm = {
  name: string;
  description: string;
  conditions: RuleCondition[];
  conditionLogic: "AND" | "OR";
  action: "approve" | "flag" | "block";
  priority: number;
  enabled: boolean;
};

type FraudRule = {
  id: number;
  name: string;
  description?: string | null;
  conditions: RuleCondition[];
  conditionLogic: "AND" | "OR";
  action: "approve" | "flag" | "block";
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const FIELDS: { value: RuleCondition["field"]; label: string; type: "number" | "string" }[] = [
  { value: "amount", label: "Amount ($)", type: "number" },
  { value: "merchantCategory", label: "Merchant Category", type: "string" },
  { value: "location", label: "Location", type: "string" },
  { value: "fraudScore", label: "Fraud Score (0–1)", type: "number" },
  { value: "riskLevel", label: "Risk Level", type: "string" },
];

const OPERATORS_NUM = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "equals", label: "=" },
];

const OPERATORS_STR = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "in", label: "is one of" },
];

const ACTION_CONFIG = {
  approve: { label: "Approve", icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  flag: { label: "Flag", icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  block: { label: "Block", icon: ShieldX, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

const PRESETS = [
  {
    name: "Block large crypto transactions",
    description: "Block any crypto transaction over $5,000",
    conditions: [
      { field: "merchantCategory" as const, operator: "equals" as const, value: "crypto" },
      { field: "amount" as const, operator: "gt" as const, value: "5000" },
    ],
    conditionLogic: "AND" as const,
    action: "block" as const,
    priority: 10,
  },
  {
    name: "Flag gambling activity",
    description: "Flag all gambling transactions for review",
    conditions: [{ field: "merchantCategory" as const, operator: "equals" as const, value: "gambling" }],
    conditionLogic: "AND" as const,
    action: "flag" as const,
    priority: 20,
  },
  {
    name: "Block wire transfers over $10k",
    description: "Block wire transfers above $10,000",
    conditions: [
      { field: "merchantCategory" as const, operator: "equals" as const, value: "wire_transfer" },
      { field: "amount" as const, operator: "gt" as const, value: "10000" },
    ],
    conditionLogic: "AND" as const,
    action: "block" as const,
    priority: 5,
  },
  {
    name: "Flag high fraud score",
    description: "Flag transactions with a fraud score above 60%",
    conditions: [{ field: "fraudScore" as const, operator: "gte" as const, value: "0.6" }],
    conditionLogic: "AND" as const,
    action: "flag" as const,
    priority: 30,
  },
  {
    name: "Block critical risk",
    description: "Block any transaction assessed as critical risk",
    conditions: [{ field: "riskLevel" as const, operator: "equals" as const, value: "critical" }],
    conditionLogic: "AND" as const,
    action: "block" as const,
    priority: 1,
  },
];

const emptyCondition = (): RuleCondition => ({
  field: "amount",
  operator: "gt",
  value: "",
});

const defaultForm = (): RuleForm => ({
  name: "",
  description: "",
  conditions: [emptyCondition()],
  conditionLogic: "AND",
  action: "flag",
  priority: 100,
  enabled: true,
});

function conditionLabel(c: RuleCondition): string {
  const field = FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
  const opStr =
    [...OPERATORS_NUM, ...OPERATORS_STR].find((o) => o.value === c.operator)?.label ?? c.operator;
  return `${field} ${opStr} ${c.value}`;
}

function ConditionEditor({
  cond,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  cond: RuleCondition;
  index: number;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fieldDef = FIELDS.find((f) => f.value === cond.field);
  const isNum = fieldDef?.type === "number";
  const operators = isNum ? OPERATORS_NUM : OPERATORS_STR;

  function handleFieldChange(field: RuleCondition["field"]) {
    const newFieldDef = FIELDS.find((f) => f.value === field);
    const newIsNum = newFieldDef?.type === "number";
    onChange({
      field,
      operator: (newIsNum ? "gt" : "equals") as RuleCondition["operator"],
      value: "",
    });
  }

  return (
    <div className="flex items-center gap-2">
      <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
      <select
        value={cond.field}
        onChange={(e) => handleFieldChange(e.target.value as RuleCondition["field"])}
        className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1"
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select
        value={cond.operator}
        onChange={(e) => onChange({ ...cond, operator: e.target.value as RuleCondition["operator"] })}
        className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-28"
      >
        {operators.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        type={isNum ? "number" : "text"}
        value={cond.value}
        onChange={(e) => onChange({ ...cond, value: e.target.value })}
        placeholder={
          cond.field === "merchantCategory"
            ? "crypto, gambling…"
            : cond.field === "riskLevel"
            ? "low, medium, high, critical"
            : cond.operator === "in"
            ? "val1, val2…"
            : "value"
        }
        className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-0"
      />
      {canRemove && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-red-400 transition flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function RuleModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: RuleForm;
  onSave: (form: RuleForm) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RuleForm>(initial ?? defaultForm());
  const [showPresets, setShowPresets] = useState(!initial);

  function updateCondition(i: number, c: RuleCondition) {
    setForm((f) => {
      const conds = [...f.conditions];
      conds[i] = c;
      return { ...f, conditions: conds };
    });
  }

  function removeCondition(i: number) {
    setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  }

  function addCondition() {
    setForm((f) => ({ ...f, conditions: [...f.conditions, emptyCondition()] }));
  }

  function applyPreset(p: typeof PRESETS[0]) {
    setForm((f) => ({
      ...f,
      name: p.name,
      description: p.description,
      conditions: p.conditions.map((c) => ({ ...c, value: String(c.value) })),
      conditionLogic: p.conditionLogic,
      action: p.action,
      priority: p.priority,
    }));
    setShowPresets(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Rule name is required"); return; }
    if (form.conditions.some((c) => !c.value.toString().trim())) {
      toast.error("All conditions must have a value");
      return;
    }
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? "Edit Rule" : "Create Rule"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Presets */}
          {showPresets && (
            <div>
              <button
                type="button"
                onClick={() => setShowPresets(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition mb-2"
              >
                <ChevronDown className="w-3 h-3" />
                Start from a preset
              </button>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`text-left px-3 py-2 rounded-lg border text-xs transition hover:bg-muted/50 ${
                      ACTION_CONFIG[p.action].bg
                    }`}
                  >
                    <span className={`font-medium ${ACTION_CONFIG[p.action].color}`}>{p.name}</span>
                    <span className="text-muted-foreground ml-2">{p.description}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or build from scratch</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rule Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Block high-value crypto transactions"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional description"
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Conditions *</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Match</span>
                {(["AND", "OR"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, conditionLogic: l }))}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                      form.conditionLogic === l
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground">conditions</span>
              </div>
            </div>
            <div className="space-y-2">
              {form.conditions.map((c, i) => (
                <ConditionEditor
                  key={i}
                  cond={c}
                  index={i}
                  onChange={(nc) => updateCondition(i, nc)}
                  onRemove={() => removeCondition(i)}
                  canRemove={form.conditions.length > 1}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addCondition}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </button>
          </div>

          {/* Action */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Action *</label>
            <div className="flex gap-2">
              {(["approve", "flag", "block"] as const).map((a) => {
                const cfg = ACTION_CONFIG[a];
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, action: a }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                      form.action === a ? cfg.bg + " " + cfg.color : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority + Enabled */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Priority <span className="text-muted-foreground/60">(lower = first)</span>
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 100 }))}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Enabled</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`mt-0.5 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                  form.enabled
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "border-border text-muted-foreground"
                }`}
              >
                {form.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {form.enabled ? "Yes" : "No"}
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RulesPage() {
  const queryClient = useQueryClient();
  const queryKey = getListRulesQueryKey();

  const { data: rules = [], isLoading } = useListRules({
    query: { queryKey },
  });

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FraudRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FraudRule | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useCreateRule({
    mutation: {
      onSuccess: () => { invalidate(); setShowModal(false); toast.success("Rule created"); },
      onError: () => toast.error("Failed to create rule"),
    },
  });

  const updateMutation = useUpdateRule({
    mutation: {
      onSuccess: () => { invalidate(); setEditTarget(null); toast.success("Rule updated"); },
      onError: () => toast.error("Failed to update rule"),
    },
  });

  const deleteMutation = useDeleteRule({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteTarget(null); toast.success("Rule deleted"); },
      onError: () => toast.error("Failed to delete rule"),
    },
  });

  const toggleMutation = useToggleRule({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        toast.success((data as FraudRule).enabled ? "Rule enabled" : "Rule disabled");
      },
    },
  });

  function handleSave(form: RuleForm) {
    const conditions = form.conditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      value: c.field === "amount" || c.field === "fraudScore"
        ? parseFloat(c.value)
        : c.operator === "in"
        ? c.value.split(",").map((v) => v.trim())
        : c.value,
    }));

    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: { ...form, conditions } });
    } else {
      createMutation.mutate({ data: { ...form, conditions } });
    }
  }

  const typed = rules as FraudRule[];
  const enabled = typed.filter((r) => r.enabled).length;
  const disabled = typed.filter((r) => !r.enabled).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rule Engine</h1>
          <p className="text-sm text-muted-foreground">
            Define custom rules that override the fraud scoring engine. Rules are evaluated in priority order — lower number = higher priority.
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Summary badges */}
      {typed.length > 0 && (
        <div className="flex gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="text-xl font-bold text-foreground">{typed.length}</div>
            <div className="text-xs text-muted-foreground">Total rules</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="text-xl font-bold text-green-400">{enabled}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="text-xl font-bold text-muted-foreground">{disabled}</div>
            <div className="text-xs text-muted-foreground">Disabled</div>
          </div>
        </div>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : typed.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first rule to override the default fraud scoring engine.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {PRESETS.slice(0, 3).map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  createMutation.mutate({
                    data: {
                      ...p,
                      conditions: p.conditions.map((c) => ({
                        ...c,
                        value: typeof c.value === "string" ? parseFloat(c.value) || c.value : c.value,
                      })) as any,
                    },
                  });
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${ACTION_CONFIG[p.action].bg} ${ACTION_CONFIG[p.action].color}`}
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {typed.map((rule) => {
            const cfg = ACTION_CONFIG[rule.action];
            return (
              <div
                key={rule.id}
                className={`bg-card border rounded-xl p-5 transition ${
                  rule.enabled ? "border-border" : "border-border/40 opacity-60"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Priority badge */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <span className="text-xs font-bold text-muted-foreground">#{rule.priority}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {!rule.enabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Disabled
                        </span>
                      )}
                    </div>

                    {rule.description && (
                      <p className="text-xs text-muted-foreground mb-2">{rule.description}</p>
                    )}

                    {/* Conditions */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {(rule.conditions as RuleCondition[]).map((c, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]">
                              {rule.conditionLogic}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-mono">
                            {conditionLabel(c)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id })}
                      title={rule.enabled ? "Disable" : "Enable"}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition"
                    >
                      {rule.enabled
                        ? <ToggleRight className="w-4 h-4 text-green-400" />
                        : <ToggleLeft className="w-4 h-4" />
                      }
                    </button>
                    <button
                      onClick={() => setEditTarget(rule)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(rule)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <RuleModal
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={createMutation.isPending}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <RuleModal
          initial={{
            name: editTarget.name,
            description: editTarget.description ?? "",
            conditions: (editTarget.conditions as RuleCondition[]).map((c) => ({
              ...c,
              value: Array.isArray(c.value) ? c.value.join(", ") : String(c.value),
            })),
            conditionLogic: editTarget.conditionLogic,
            action: editTarget.action,
            priority: editTarget.priority,
            enabled: editTarget.enabled,
          }}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
          saving={updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-sm font-semibold text-foreground mb-2">Delete Rule</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteTarget.name}"</span>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id })}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
