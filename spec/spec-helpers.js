'use babel'

export function waitsForAsync(asynCallback, result) {
  waitsForPromise({ timeout: 15 * 1000 }, function () {
    return asynCallback().then(function (returnValue) {
      if (typeof result !== 'undefined') {
        expect(returnValue).toEqual(result)
      }
    })
  })
}

export function waitsForAsyncRejection(asynCallback, errorMessage) {
  waitsForPromise({ timeout: 15 * 1000 }, function () {
    return asynCallback().then(function () {
      expect(false).toBe(true)
    }, function (error) {
      if (typeof errorMessage !== 'undefined') {
        expect(error.message).toEqual(errorMessage)
      }
    })
  })
}

// Jasmine 1.3.x has no sane way of resetting to native clocks, and since we're
// gonna test promises and such, we're gonna need it
function resetClock() {
  for (const key in jasmine.Clock.real) {
    if (jasmine.Clock.hasOwnProperty('real')) {
      window[key] = jasmine.Clock.real[key]
    }
  }
}

beforeEach(function () {
  resetClock()
})
