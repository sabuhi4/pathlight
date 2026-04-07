import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./index.css";

type Effort = "light" | "steady" | "intense";
type PlanKind = "launch" | "study" | "habit" | "ops";

type PlanForm = {
  userName: string;
  goal: string;
  deadline: string;
  effort: Effort;
  planKind: PlanKind;
  constraint: string;
};

type PlanStep = {
  id: string;
  title: string;
  detail: string;
};

type PlanResult = {
  headline: string;
  summary: string;
  successSignal: string;
  steps: PlanStep[];
};

type SubmittedSnapshot = {
  goal: string;
  deadline: string;
  planKind: PlanKind;
  effort: Effort;
  constraint: string;
};

type PersistedPlannerState = {
  form: PlanForm;
  plan: PlanResult | null;
  submitted: SubmittedSnapshot | null;
  completed: string[];
};

const defaultForm: PlanForm = {
  userName: "",
  goal: "",
  deadline: "7 days",
  effort: "steady",
  planKind: "launch",
  constraint: "",
};

const planIntros: Record<PlanKind, string> = {
  launch: "a launch sprint",
  study: "a focused study sprint",
  habit: "a repeatable habit plan",
  ops: "an operations cleanup sprint",
};

const effortLabels: Record<Effort, string> = {
  light: "30 minutes a day",
  steady: "60 to 90 minutes a day",
  intense: "2 deep work blocks a day",
};

const planKindLabels: Record<PlanKind, string> = {
  launch: "Product launch",
  study: "Study sprint",
  habit: "Habit reset",
  ops: "Operations cleanup",
};

const exampleGoals: Array<{
  label: string;
  goal: string;
  planKind: PlanKind;
  effort: Effort;
}> = [
  {
    label: "Launch example",
    goal: "Launch my event landing page",
    planKind: "launch",
    effort: "steady",
  },
  {
    label: "Study example",
    goal: "Prepare for my frontend interview",
    planKind: "study",
    effort: "steady",
  },
  {
    label: "Habit example",
    goal: "Build a daily writing habit",
    planKind: "habit",
    effort: "light",
  },
];

const STORAGE_KEY = "pathlight-planner-state";

function normalizeText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeForm(form: PlanForm): PlanForm {
  return {
    userName: normalizeText(form.userName, 40),
    goal: normalizeText(form.goal, 120),
    deadline: normalizeText(form.deadline, 40) || "7 days",
    effort: form.effort,
    planKind: form.planKind,
    constraint: normalizeText(form.constraint, 180),
  };
}

function buildSteps(form: PlanForm): PlanStep[] {
  const stepsByKind: Record<PlanKind, PlanStep[]> = {
    launch: [
      {
        id: "clarify",
        title: "Write the one-sentence promise",
        detail: "State who this is for, what it solves, and why it matters in one line.",
      },
      {
        id: "proof",
        title: "Assemble proof before polish",
        detail: "Create one example, testimonial, demo, or screenshot that makes the idea believable.",
      },
      {
        id: "flow",
        title: "Build the single conversion path",
        detail: "Make one visitor journey obvious from landing page to success state with no dead ends.",
      },
      {
        id: "ship",
        title: "Ship and request five reactions",
        detail: "Share the live version quickly and collect concrete feedback instead of guessing.",
      },
    ],
    study: [
      {
        id: "scope",
        title: "Cut the syllabus to one outcome",
        detail: "Define the exact skill or topic you need to demonstrate by the deadline.",
      },
      {
        id: "practice",
        title: "Practice with retrieval, not rereading",
        detail: "Use short quizzes, flash prompts, or whiteboard recall to expose gaps fast.",
      },
      {
        id: "project",
        title: "Create one applied example",
        detail: "Build a small artifact or explanation that proves you can use the concept.",
      },
      {
        id: "review",
        title: "Finish with a timed review round",
        detail: "Simulate real pressure once so the final attempt feels familiar and calm.",
      },
    ],
    habit: [
      {
        id: "trigger",
        title: "Choose one reliable trigger",
        detail: "Attach the habit to something you already do at the same time each day.",
      },
      {
        id: "tiny",
        title: "Shrink the first version",
        detail: "Make the first repetition so small it is hard to skip even on a low-energy day.",
      },
      {
        id: "track",
        title: "Track completion visibly",
        detail: "Use a simple streak or checkbox so success is obvious without opening extra tools.",
      },
      {
        id: "recover",
        title: "Define the reset rule",
        detail: "Decide in advance how you recover after one missed day so the habit does not break.",
      },
    ],
    ops: [
      {
        id: "audit",
        title: "Audit the current bottleneck",
        detail: "Find the task that wastes the most time or causes the most repeated confusion.",
      },
      {
        id: "document",
        title: "Write one source of truth",
        detail: "Create a short checklist or guide so the process can be repeated by someone else.",
      },
      {
        id: "automate",
        title: "Automate the obvious repeat work",
        detail: "Remove one manual step that happens frequently enough to justify the change.",
      },
      {
        id: "verify",
        title: "Run the new process once end to end",
        detail: "Confirm the system works without extra explanations or hidden setup.",
      },
    ],
  };

  return stepsByKind[form.planKind].map((step) => ({
    ...step,
    detail:
      step.detail +
      (form.constraint
        ? ` Keep the constraint in view: ${form.constraint}.`
        : ""),
  }));
}

function buildPlan(form: PlanForm): PlanResult {
  const firstName = form.userName.trim() || "Builder";
  const intro = planIntros[form.planKind];
  const steps = buildSteps(form);
  const goal = form.goal.trim() || "finish one meaningful goal";
  const deadline = form.deadline.trim() || "7 days";

  return {
    headline: `${firstName}, this is your ${intro}`,
    summary: `You want to ${goal} in ${deadline}. The recommended pace is ${effortLabels[form.effort]}. Focus on finishing one clean outcome instead of expanding scope.`,
    successSignal: `Success looks like this: by the end of ${deadline}, you can point to a finished outcome for "${goal}" and explain it clearly in under 30 seconds.`,
    steps,
  };
}

function App() {
  const [form, setForm] = useState<PlanForm>(defaultForm);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedSnapshot | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Complete the form to generate your sprint plan."
  );
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const goalInputRef = useRef<HTMLInputElement>(null);

  const completedCount = completed.length;
  const totalSteps = plan?.steps.length ?? 0;
  const isComplete = Boolean(plan) && totalSteps > 0 && completedCount === totalSteps;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedPlannerState;
      if (parsed.form) {
        setForm(parsed.form);
      }
      if (parsed.plan) {
        setPlan(parsed.plan);
      }
      if (parsed.submitted) {
        setSubmitted(parsed.submitted);
      }
      if (Array.isArray(parsed.completed)) {
        setCompleted(parsed.completed);
      }
      if (parsed.plan) {
        setAnnouncement("Previous sprint restored. You can keep going.");
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload: PersistedPlannerState = {
      form,
      plan,
      submitted,
      completed,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [form, plan, submitted, completed]);

  function focusPlanner() {
    formHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      goalInputRef.current?.focus();
    });
  }

  function handleChange<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyExample(example: (typeof exampleGoals)[number]) {
    setForm((current) => ({
      ...current,
      goal: example.goal,
      planKind: example.planKind,
      effort: example.effort,
      deadline: current.deadline || "7 days",
    }));
    setFormError("");
    setAnnouncement(`${example.label} loaded. You can generate the plan now.`);
    window.requestAnimationFrame(() => {
      goalInputRef.current?.focus();
    });
  }

  function tryExamplePlan() {
    const demoForm: PlanForm = {
      userName: form.userName,
      goal: "Launch my event landing page",
      deadline: "7 days",
      effort: "steady",
      planKind: "launch",
      constraint: "Limited time after work",
    };

    setForm(demoForm);
    setFormError("");
    setAnnouncement("Example plan loaded. Review or generate it now.");

    window.requestAnimationFrame(() => {
      goalInputRef.current?.focus();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const sanitized = sanitizeForm(form);
    const trimmedGoal = sanitized.goal;

    if (!trimmedGoal) {
      setFormError("Enter a goal before generating a plan.");
      setAnnouncement("Enter a goal before generating a plan.");
      window.requestAnimationFrame(() => {
        goalInputRef.current?.focus();
      });
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setForm(sanitized);
    const nextPlan = buildPlan(sanitized);
    setPlan(nextPlan);
    setSubmitted({
      goal: sanitized.goal,
      deadline: sanitized.deadline,
      planKind: sanitized.planKind,
      effort: sanitized.effort,
      constraint: sanitized.constraint,
    });
    setCompleted([]);
    setAnnouncement(`Plan generated for ${trimmedGoal}. Review the checklist below.`);

    window.requestAnimationFrame(() => {
      resultsHeadingRef.current?.focus();
      setIsSubmitting(false);
    });
  }

  function toggleStep(stepId: string) {
    setCompleted((current) => {
      const next = current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId];

      if (plan) {
        const count = next.length;
        setAnnouncement(
          count === plan.steps.length
            ? `Sprint complete for ${submitted?.goal ?? form.goal.trim()}.`
            : `${count} of ${plan.steps.length} steps completed.`
        );
      }

      return next;
    });
  }

  function resetPlanner() {
    setForm(defaultForm);
    setPlan(null);
    setSubmitted(null);
    setCompleted([]);
    setFormError("");
    setIsSubmitting(false);
    setAnnouncement("Planner reset. You can start a new sprint now.");
    window.localStorage.removeItem(STORAGE_KEY);
    window.requestAnimationFrame(() => {
      focusPlanner();
    });
  }

  return (
    <div className="app-shell">
      <a href="#planner-heading" className="skip-link">
        Skip to planner
      </a>
      <nav className="top-nav" aria-label="Primary">
        <p className="brand-mark">Pathlight</p>
        <div className="nav-links">
          <a href="#planner-heading">Planner</a>
          <a href="#results-heading">Results</a>
        </div>
      </nav>
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Pathlight</p>
          <h1>Turn one goal into a focused action plan in under a minute.</h1>
          <p className="lede">
            Describe what you want to finish, choose your pace, and get a clear
            four-step sprint with a visible success state.
          </p>
          <ol className="hero-steps" aria-label="How Pathlight works">
            <li>1. Fill in one short form.</li>
            <li>2. Generate one sprint plan.</li>
            <li>3. Complete every checklist step.</li>
          </ol>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={focusPlanner}>
              Create My Plan
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={tryExamplePlan}
              data-testid="try-example-plan-button"
            >
              Try Example Plan
            </button>
          </div>
        </div>
        <aside className="hero-card" aria-label="Product summary">
          <h2>What this app does</h2>
          <p>Pathlight creates a short, practical sprint for one specific goal.</p>
          <ul>
            <li>One form</li>
            <li>One generated plan</li>
            <li>One checklist that ends in a clear completion message</li>
          </ul>
        </aside>
      </header>

      <main id="main-content">
        <section className="planner-section" aria-labelledby="planner-heading">
          <div className="section-heading">
            <p className="section-kicker">Primary flow</p>
            <h2 id="planner-heading" ref={formHeadingRef} tabIndex={-1}>
              Build your sprint plan
            </h2>
            <p>
              Fill in the form, submit once, and Pathlight will generate a plan
              you can complete step by step.
            </p>
          </div>

          <form className="planner-form" onSubmit={handleSubmit}>
            <label htmlFor="userName">Your name</label>
            <input
              id="userName"
              name="userName"
              type="text"
              placeholder="Ava"
              value={form.userName}
              onChange={(event) => handleChange("userName", event.target.value)}
              data-testid="name-input"
              aria-describedby="name-help"
            />
            <p id="name-help" className="field-help">
              Optional. If you skip this, the plan will address you as Builder.
            </p>

            <label htmlFor="goal">What do you want to finish?</label>
            <input
              ref={goalInputRef}
              id="goal"
              name="goal"
              type="text"
              required
              aria-required="true"
              aria-describedby={formError ? "goal-help goal-error" : "goal-help"}
              aria-invalid={formError ? "true" : "false"}
              placeholder="Launch my event landing page"
              value={form.goal}
              onChange={(event) => {
                handleChange("goal", event.target.value);
                if (formError && event.target.value.trim()) {
                  setFormError("");
                }
              }}
              data-testid="goal-input"
            />
            <p id="goal-help" className="field-help">
              Use one concrete finish line, not a broad wishlist. Long text will be shortened.
            </p>
            <div className="example-buttons" aria-label="Example goals">
              {exampleGoals.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  className="example-button"
                  onClick={() => applyExample(example)}
                  data-testid={`example-${example.planKind}-button`}
                >
                  {example.label}
                </button>
              ))}
            </div>
            {formError ? (
              <p id="goal-error" className="field-error" role="alert">
                {formError}
              </p>
            ) : null}

            <label htmlFor="deadline">Deadline</label>
            <input
              id="deadline"
              name="deadline"
              type="text"
              required
              aria-required="true"
              aria-describedby="deadline-help"
              placeholder="7 days"
              value={form.deadline}
              onChange={(event) => handleChange("deadline", event.target.value)}
              data-testid="deadline-input"
            />
            <p id="deadline-help" className="field-help">
              Use a short phrase such as 3 days, 1 week, or this weekend.
            </p>

            <label htmlFor="planKind">Plan type</label>
            <select
              id="planKind"
              name="planKind"
              value={form.planKind}
              data-testid="plan-type-select"
              aria-describedby="plan-type-help"
              onChange={(event) =>
                handleChange("planKind", event.target.value as PlanKind)
              }
            >
              <option value="launch">Product launch</option>
              <option value="study">Study sprint</option>
              <option value="habit">Habit reset</option>
              <option value="ops">Operations cleanup</option>
            </select>
            <p id="plan-type-help" className="field-help">
              Choose the type that best matches your goal so the checklist fits the task.
            </p>

            <fieldset className="effort-fieldset" aria-describedby="effort-help">
              <legend>Available effort</legend>
              <label>
                <input
                  type="radio"
                  name="effort"
                  value="light"
                  checked={form.effort === "light"}
                  onChange={() => handleChange("effort", "light")}
                  data-testid="effort-light"
                />
                Light
              </label>
              <label>
                <input
                  type="radio"
                  name="effort"
                  value="steady"
                  checked={form.effort === "steady"}
                  onChange={() => handleChange("effort", "steady")}
                  data-testid="effort-steady"
                />
                Steady
              </label>
              <label>
                <input
                  type="radio"
                  name="effort"
                  value="intense"
                  checked={form.effort === "intense"}
                  onChange={() => handleChange("effort", "intense")}
                  data-testid="effort-intense"
                />
                Intense
              </label>
            </fieldset>
            <p id="effort-help" className="field-help">
              This controls the pace recommendation shown in your generated plan.
            </p>

            <label htmlFor="constraint">Constraint or blocker</label>
            <textarea
              id="constraint"
              name="constraint"
              rows={4}
              aria-describedby="constraint-help"
              placeholder="Limited time after work, small budget, no designer"
              value={form.constraint}
              onChange={(event) => handleChange("constraint", event.target.value)}
              data-testid="constraint-input"
            />
            <p id="constraint-help" className="field-help">
              Optional. Add limits such as time, budget, or missing resources.
            </p>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
              data-testid="generate-plan-button"
              aria-describedby="generate-plan-note"
              disabled={isSubmitting}
            >
                {isSubmitting ? "Generating Plan..." : "Generate Plan"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={resetPlanner}
                data-testid="reset-plan-button"
              >
                Reset
              </button>
            </div>
            <p id="generate-plan-note" className="field-help">
              The main path is: generate a plan, then complete all checklist steps.
            </p>
          </form>
        </section>

        <section
          className="results-section"
          aria-labelledby="results-heading"
        >
          <div className="section-heading">
            <p className="section-kicker">Result</p>
            <h2
              id="results-heading"
              ref={resultsHeadingRef}
              tabIndex={-1}
              data-testid="results-heading"
            >
              {plan ? "Your active sprint" : "No plan generated yet"}
            </h2>
            <p data-testid="status-message" role="status" aria-live="polite">
              {announcement}
            </p>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>
          </div>

          {plan ? (
            <article className="plan-card" data-testid="plan-card">
              <header className="plan-header">
                <div>
                  <p className="status-pill">Plan ready</p>
                  <h3>{plan.headline}</h3>
                </div>
                <p className="progress-text" data-testid="progress-text">
                  {completedCount}/{totalSteps} steps complete
                </p>
              </header>

              <div className="progress-block">
                <label htmlFor="completion-progress" className="progress-label">
                  Completion progress
                </label>
                <progress
                  id="completion-progress"
                  max={totalSteps || 1}
                  value={completedCount}
                  data-testid="completion-progress"
                  aria-describedby="completion-progress-text"
                >
                  {completedCount} of {totalSteps} steps complete
                </progress>
                <p id="completion-progress-text" className="field-help">
                  {completedCount} of {totalSteps} steps complete
                </p>
              </div>

              {submitted ? (
                <section
                  className="summary-card"
                  aria-label="Submitted plan details"
                  data-testid="submitted-summary"
                >
                  <h4>Submitted details</h4>
                  <dl className="summary-grid">
                    <div>
                      <dt>Goal</dt>
                      <dd>{submitted.goal}</dd>
                    </div>
                    <div>
                      <dt>Deadline</dt>
                      <dd>{submitted.deadline}</dd>
                    </div>
                    <div>
                      <dt>Plan type</dt>
                      <dd>{planKindLabels[submitted.planKind]}</dd>
                    </div>
                    <div>
                      <dt>Effort</dt>
                      <dd>{submitted.effort}</dd>
                    </div>
                    {submitted.constraint ? (
                      <div className="summary-span">
                        <dt>Constraint</dt>
                        <dd>{submitted.constraint}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
              ) : null}

              <p>{plan.summary}</p>
              {!isComplete ? (
                <p className="success-signal">
                  <strong>Finish line:</strong> {plan.successSignal}
                </p>
              ) : null}

              <ol
                className="checklist"
                aria-label="Sprint checklist"
                data-testid="plan-checklist"
              >
                {plan.steps.map((step, index) => {
                  const checked = completed.includes(step.id);

                  return (
                    <li
                      key={step.id}
                      className={checked ? "checklist-item is-done" : "checklist-item"}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStep(step.id)}
                          aria-label={`Mark step ${index + 1} complete: ${step.title}`}
                          data-testid={`step-checkbox-${index + 1}`}
                        />
                        <span>
                          <strong>
                            Step {index + 1}: {step.title}
                          </strong>
                          <small>{step.detail}</small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ol>

              {isComplete ? (
                <section className="completion-panel" aria-label="Sprint complete">
                  <div data-testid="completion-state" role="status" aria-live="polite">
                    <h3>Sprint complete</h3>
                    <p>
                      You finished every step for <strong>{submitted?.goal ?? form.goal}</strong>.
                      This is the intended success state of the app.
                    </p>
                    <p className="completion-note">
                      Congratulations. Your sprint is fully complete and ready to reset or start again.
                    </p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={resetPlanner}
                      data-testid="start-new-sprint-button"
                    >
                      Start a New Sprint
                    </button>
                  </div>
                </section>
              ) : null}
            </article>
          ) : (
            <article className="empty-state" data-testid="empty-state">
              <h3>Generate a plan to see your checklist</h3>
              <p>
                The app is complete when a user submits the form, receives a
                sprint, and checks off every step until the completion panel appears.
              </p>
            </article>
          )}
        </section>
      </main>
      <footer className="page-footer">
        <p>Accessible single-page planner with one primary flow and one clear finish line.</p>
      </footer>
    </div>
  );
}

export default App;
