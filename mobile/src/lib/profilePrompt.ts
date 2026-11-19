/**
 * New users are shown the traveller profile form once per app session, whether it was opened by
 * the register screen or by the tabs layout (first Google sign-in). Kept outside React so it
 * survives the tabs layout being mounted again after "Skip for now" (BUG-08).
 */
const shown = new Set<string>();

export const profilePromptShown = (userId: string) => shown.has(userId);

export const markProfilePromptShown = (userId: string) => {
  shown.add(userId);
};
