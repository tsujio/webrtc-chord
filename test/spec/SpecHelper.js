define([], function() {
  beforeEach(function () {
    jasmine.addMatchers({
      toEqualId: function() {
        return  {
          compare: function(actual, expected) {
            return {
              pass: actual.equals(expected)
            };
          }
        };
      },

      toEqualNode: function() {
        return  {
          compare: function(actual, expected) {
            return {
              pass: actual.equals(expected)
            };
          }
        };
      }
    });
  });
});
