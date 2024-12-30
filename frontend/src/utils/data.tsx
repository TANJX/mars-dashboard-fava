const isPastDate = (date: string | undefined) => {
    if (!date) return false;
    const today = new Date().toISOString().split("T")[0];
    return date < today;
};

function currencyFormatter(value: string, currency = "$") {
    if (!value || value === "" || value === "0") {
        return "";
    }
    const num = parseFloat(value);
    return isNaN(num) ? "" : (num < 0 ? "-" + currency + Math.abs(num).toFixed(2) : currency + num.toFixed(2));
}

function evaluateFormula(formula: string) {
    try {
        const result = eval(formula.slice(1));
        return isNaN(result) ? 0 : result;
    } catch (error) {
        console.warn('Formula evaluation error:', error);
        return 0;
    }
}

function parseValue(value: string) {
    if (!value || value === "") return 0;

    if (typeof value === 'string' && value.startsWith('=')) {
        return evaluateFormula(value);
    }

    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

function formulaFormatter(value: string) {
    if (!value || value === "") return "";
    return currencyFormatter(parseValue(value));
}

export { isPastDate, currencyFormatter, evaluateFormula, parseValue, formulaFormatter };
