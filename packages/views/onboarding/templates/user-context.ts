/**
 * Onboarding user-context section builder.
 *
 * Renders the persisted onboarding questionnaire (role + use_case) into a
 * short markdown section prepended to the agent's system prompt. Empty
 * questionnaires produce an empty string so the section is omitted entirely,
 * keeping the prompt free of an empty "About me" heading.
 *
 * The "other" slug (role or use_case) is a placeholder for free-text supplied
 * in `role_other` / `use_case_other`. When that free-text is blank the slug
 * contributes nothing — not even the generic localized "Other" label — so a
 * user who picked "Other" but typed no detail is treated as having given no
 * answer for that field.
 */

/**
 * Loose, defensive view of the persisted onboarding questionnaire. All fields
 * are optional and stringly-typed because this renderer must tolerate partial,
 * legacy, and unknown shapes: rows written before the multi-select migration
 * stored `use_case` as a single string, older clients persist slugs no longer
 * in the enum, and any field may simply be absent. See
 * `QuestionnaireAnswers` in `@multica/core/onboarding` for the canonical
 * (strict) storage type.
 */
export interface UserContextQuestionnaire {
  role?: string | null;
  role_other?: string | null;
  /** Multi-select slugs; a legacy single string is coerced to [value]. */
  use_case?: string | string[] | null;
  use_case_other?: string | null;
}

/** Localized labels for the rendered user-context section. */
export interface UserContextLabels {
  /** Section heading, rendered bold (e.g. "About me"). */
  heading: string;
  /** Label for the role line (e.g. "Role"). */
  roleLabel: string;
  /** Label for the use_case line (e.g. "What I want to do"). */
  useCaseLabel: string;
  /** Separator between multi-select use_case values (e.g. ", " or "、"). */
  listSeparator: string;
  /** Display labels for each known role slug. */
  role: Record<string, string>;
  /** Display labels for each known use_case slug. */
  useCase: Record<string, string>;
}

const OTHER_SLUG = "other";

function resolveRole(
  questionnaire: UserContextQuestionnaire,
  labels: UserContextLabels,
): string | null {
  const role = questionnaire.role?.trim();
  if (!role) return null;
  if (role === OTHER_SLUG) {
    const other = questionnaire.role_other?.trim();
    // Blank free-text on Other => the slug contributes nothing.
    return other ? other : null;
  }
  // Fall back to the raw slug when the label map has no entry (defensive
  // against locale drift / unknown slugs persisted by older clients).
  return labels.role[role] ?? role;
}

function resolveUseCases(
  questionnaire: UserContextQuestionnaire,
  labels: UserContextLabels,
): string[] {
  const slugs = Array.isArray(questionnaire.use_case)
    ? questionnaire.use_case
    : questionnaire.use_case
      ? [questionnaire.use_case]
      : [];

  const parts: string[] = [];
  for (const slug of slugs) {
    if (slug === OTHER_SLUG) {
      const other = questionnaire.use_case_other?.trim();
      if (other) {
        parts.push(other);
      }
      // Blank free-text on Other => the slug contributes nothing.
      continue;
    }
    parts.push(labels.useCase[slug] ?? slug);
  }
  return parts;
}

/**
 * Build the markdown user-context section for a persisted questionnaire.
 *
 * Returns an empty string when the questionnaire is missing or both fields
 * are blank, so callers can unconditionally prepend the result without
 * leaving an empty heading in the prompt.
 */
export function buildUserContextSection(
  questionnaire: UserContextQuestionnaire | null | undefined,
  labels: UserContextLabels,
): string {
  if (!questionnaire) return "";

  const roleDisplay = resolveRole(questionnaire, labels);
  const useCaseParts = resolveUseCases(questionnaire, labels);
  const useCaseDisplay = useCaseParts.length
    ? useCaseParts.join(labels.listSeparator)
    : null;

  if (!roleDisplay && !useCaseDisplay) return "";

  // Lead with a horizontal rule so the section doesn't fuse with the
  // preceding prompt body when prepended.
  const lines = [`\n\n---\n\n**${labels.heading}**`];
  if (roleDisplay) {
    lines.push(`${labels.roleLabel}: ${roleDisplay}`);
  }
  if (useCaseDisplay) {
    lines.push(`${labels.useCaseLabel}: ${useCaseDisplay}`);
  }
  return lines.join("\n");
}
