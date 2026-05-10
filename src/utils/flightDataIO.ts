import type { LogbookData, LogbookEntry } from '../types';

/**
 * Export flight data to JSON file
 */
export function exportFlightData(data: LogbookData): void {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `flight_${data.date || 'data'}_${data.ac}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Import flight data from JSON file
 */
export function importFlightData(file: File): Promise<LogbookData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content) as LogbookData;

                // Validate the data structure
                if (!data.date || !data.ac || !Array.isArray(data.crew) || !Array.isArray(data.legs)) {
                    throw new Error('Invalid flight data format');
                }

                resolve(data);
            } catch (error) {
                reject(new Error('Failed to parse flight data: ' + (error as Error).message));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Export specific logbook entries (e.g. for month backup)
 */
export function exportLogbookEntries(entries: LogbookEntry[], filename: string): void {
    const jsonStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Import logbook entries
 */
export function importLogbookEntries(file: File): Promise<LogbookEntry[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content) as LogbookEntry[];
                if (!Array.isArray(data)) {
                    throw new Error('Invalid format: Expected array of entries');
                }
                resolve(data);
            } catch (error) {
                reject(new Error('Failed to parse entries: ' + (error as Error).message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
