export interface ToolbarPosition {
    top: number;
    left: number;
    transform: string;
}

export interface PositioningParams {
    rect: DOMRect;
    viewportWidth: number;
    viewportHeight: number;
    dragStartWeekIndex: number;
    dragEndWeekIndex: number;
    bottomSafetyMargin?: number;
    rightSafetyMargin?: number;
}

/**
 * Calculates the best position for a selection toolbar based on available viewport space.
 * Tries to position BELOW by default, then RIGHT/LEFT, then ABOVE if necessary.
 */
export function calculateBestToolbarPosition(params: PositioningParams): ToolbarPosition {
    const {
        rect,
        viewportWidth,
        viewportHeight,
        dragStartWeekIndex,
        dragEndWeekIndex,
        bottomSafetyMargin = 150,
        rightSafetyMargin = 320
    } = params;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceRight = viewportWidth - rect.right;
    const spaceLeft = rect.left;

    let top = rect.bottom;
    let left = rect.left + rect.width / 2;
    let transform = 'translate(-50%, 10px)'; // Default: centered below

    // Check if we are too close to the bottom
    if (spaceBelow < bottomSafetyMargin) {
        const preferRight = dragStartWeekIndex - dragEndWeekIndex <= 0;
        let side: 'RIGHT' | 'LEFT' | null = null;

        // Choice of side based on drag direction and space
        if (preferRight) {
            if (spaceRight > rightSafetyMargin) side = 'RIGHT';
            else if (spaceLeft > rightSafetyMargin) side = 'LEFT';
        } else {
            if (spaceLeft > rightSafetyMargin) side = 'LEFT';
            else if (spaceRight > rightSafetyMargin) side = 'RIGHT';
        }

        if (side === 'RIGHT') {
            top = rect.top + rect.height / 2;
            left = rect.right;
            transform = 'translate(10px, -50%)';
        } else if (side === 'LEFT') {
            top = rect.top + rect.height / 2;
            left = rect.left;
            transform = 'translate(calc(-100% - 10px), -50%)';
        } else if (rect.top > bottomSafetyMargin) {
            // Fallback: Stick to bottom but maybe push it up slightly if possible? 
            // Or just show ABOVE if all else fails
            top = rect.top;
            left = rect.left + rect.width / 2;
            transform = 'translate(-50%, calc(-100% - 10px))';
        }
    }

    return { top, left, transform };
}
