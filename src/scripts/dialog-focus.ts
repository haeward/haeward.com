export function containDialogFocus(event: KeyboardEvent, dialog: HTMLDialogElement): void {
    if (event.key !== "Tab" || !dialog.open) return;
    const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
    ).filter(
        (node) =>
            node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden",
    );
    if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
    }
    const current = controls.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
        ? current <= 0
            ? controls.length - 1
            : current - 1
        : (current + 1) % controls.length;
    event.preventDefault();
    controls[next]?.focus();
}
