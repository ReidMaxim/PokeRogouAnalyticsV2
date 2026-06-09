import { getPopupPreferences, updatePopupPreferences } from "../popup/popup-preferences";

export async function getRecapTimelineFilter(): Promise<string> {
  const prefs = await getPopupPreferences();
  return prefs.recapTimelineFilter;
}

export async function saveRecapTimelineFilter(filter: string): Promise<void> {
  await updatePopupPreferences({ recapTimelineFilter: filter });
}
