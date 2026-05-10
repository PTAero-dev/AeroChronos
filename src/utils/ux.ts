
export const focusNextInput = (_currentId: string, nextId: string, value: string, maxLength: number) => {
    if (value.length >= maxLength) {
        const nextElement = document.getElementById(nextId);
        if (nextElement) {
            nextElement.focus();
        }
    }
};
