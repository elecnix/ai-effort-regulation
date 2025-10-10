// Quick test to reproduce the NaN energy issue

console.log("Testing energy calculations:");

// Test 1: Normal calculation
const startTime1 = performance.now();
const endTime1 = startTime1 + 1000;
const timeElapsed1 = (endTime1 - startTime1) / 1000;
const energy1 = timeElapsed1 * 2;
console.log("Test 1 (normal):", {startTime1, endTime1, timeElapsed1, energy1});

// Test 2: What if performance.now() returns undefined?
const startTime2 = undefined;
const endTime2 = performance.now();
const timeElapsed2 = (endTime2 - startTime2) / 1000;
const energy2 = timeElapsed2 * 2;
console.log("Test 2 (undefined start):", {startTime2, endTime2, timeElapsed2, energy2});

// Test 3: What if we have NaN?
const testEnergy = NaN;
console.log("Math.round(NaN):", Math.round(testEnergy));
console.log("Math.max(-50, NaN - 10):", Math.max(-50, testEnergy - 10));

// Test 4: Defensive fix
function safeEnergyValue(value) {
  if (isNaN(value) || value === null || value === undefined) {
    return 0;
  }
  return Math.round(value);
}

console.log("Safe energy (NaN):", safeEnergyValue(NaN));
console.log("Safe energy (100):", safeEnergyValue(100));
console.log("Safe energy (undefined):", safeEnergyValue(undefined));
