import { LexoRank } from "lexorank";

/**
 * Calculates a new LexoRank for an item being moved to a new position in a list.
 * 
 * @param items - The array of items (after the move has been applied)
 * @param movedIndex - The index where the item was moved to
 * @param getRankFn - Function to extract the rank string from an item
 * @returns The new rank as a string
 */
export function calculateNewRank<T>(
    items: T[],
    movedIndex: number,
    getRankFn: (item: T) => string | undefined
): string {
    const prevItem = items[movedIndex - 1];
    const nextItem = items[movedIndex + 1];

    // Helper to safely parse rank
    const getRank = (item: T | undefined): LexoRank => {
        if (item) {
            const rankStr = getRankFn(item);
            if (rankStr) {
                try {
                    return LexoRank.parse(rankStr);
                } catch (e) {
                    // If parsing fails, return middle
                    return LexoRank.middle();
                }
            }
        }
        return LexoRank.middle();
    };

    let newRank: LexoRank;

    if (!prevItem && !nextItem) {
        // Only item in list
        newRank = LexoRank.middle();
    } else if (!prevItem) {
        // Top of list
        const nextRank = getRank(nextItem);
        newRank = nextRank.genPrev();
    } else if (!nextItem) {
        // Bottom of list
        const prevRank = getRank(prevItem);
        newRank = prevRank.genNext();
    } else {
        // Middle of list
        const prevRank = getRank(prevItem);
        const nextRank = getRank(nextItem);
        newRank = prevRank.between(nextRank);
    }

    return newRank.toString();
}

/**
 * Sorts an array of items by their rank field.
 * Items with rank come first (sorted by rank), followed by items without rank (sorted by fallback).
 * 
 * @param items - The array of items to sort
 * @param getRankFn - Function to extract the rank string from an item
 * @param fallbackSortFn - Optional fallback sorting function for items without rank
 * @returns A new sorted array
 */
export function sortByRank<T>(
    items: T[],
    getRankFn: (item: T) => string | undefined,
    fallbackSortFn?: (a: T, b: T) => number
): T[] {
    return [...items].sort((a, b) => {
        const rankA = getRankFn(a);
        const rankB = getRankFn(b);

        // Both have ranks - compare ranks
        if (rankA && rankB) {
            return rankA.localeCompare(rankB);
        }

        // Only A has rank - A comes first
        if (rankA) return -1;

        // Only B has rank - B comes first
        if (rankB) return 1;

        // Neither has rank - use fallback if provided
        if (fallbackSortFn) {
            return fallbackSortFn(a, b);
        }

        // No fallback - maintain original order
        return 0;
    });
}
