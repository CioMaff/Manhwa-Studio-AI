# Known Issues & Feature Roadmap

This document tracks known issues, bugs, and planned features for the Manhwa Studio application based on user feedback.

## Under Observation

### 1. Cross-Panel Continuity
-   **User Request:** The ability for a new panel layout to use the very last sub-panel from the *previous* layout as a continuity reference.
-   **Current Status:** Implemented & Under Observation.
-   **Commentary:** The system now uses a `lastGeneratedPanelRef` to pass the entire previously generated page as a continuity reference to the next. The new "Sequential Mode" and the redesigned Continuity Picker offer even more granular control. We are monitoring performance to ensure consistency is maintained across all modes and layouts.

## Completed (v1.7.0)

### 1. Generation Mode Selection
-   **User Request:** The ability to choose between generating a whole page at once ("Page Mode") or one sub-panel at a time ("Sequential Mode").
-   **Status:** Completed.
-   **Commentary:** The Sub-Panel Editor now includes a toggle for "Page Mode" (fast) and "Sequential Mode" (high consistency). The generation engine in the Canvas has been refactored to support both workflows.

## Planned Features / Enhancements

### 1. Advanced Asset Management
-   **User Request:** None yet, but a logical next step.
-   **Current Status:** Planned.
-   **Commentary:** Future improvements will include the ability to edit object names, assign owners directly, and potentially merge duplicate assets.

### 2. Dialogue Bubble Style Customization
-   **User Request:** None yet.
-   **Current Status:** Planned.
-   **Commentary:** Allow users to upload or select different speech bubble styles (e.g., for thoughts, shouts, whispers) from the Dialogue Styles assets.

## Resolved Issues (v1.6.0)

-   **[FIXED] Asset Re-generation:** The AI was incorrectly re-identifying and re-creating characters and objects that already existed in the project's asset list.
-   **[FIXED] Asset Continuity Race Condition:** Newly created assets (e.g., a torch in Panel 1) were not being used in the generation of Panel 2 due to parallel processing.
-   **[FIXED] Cover Art Quality:** The cover art was being generated at a low resolution or with an incorrect aspect ratio, resulting in poor quality.
-   **[FIXED] Style Reference Contamination:** The AI would sometimes draw characters *from* the style reference images instead of just adopting the art style.
