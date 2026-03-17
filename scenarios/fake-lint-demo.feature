Feature: Fake feature for lint demonstration

  # This file intentionally uses non-canonical steps to trigger vocabulary warnings.
  # Run: npm run lint:scenarios

  Scenario: Invalid steps that the linter will catch
    Given I open the homepage
    When I press the submit button
    And I type in the search box
    And I wait for 5 seconds
    Then I should not see any errors
    And the page should be displayed
