Feature: Logout functionality

  Scenario: User can log out after logging in
    Given I am on the login page
    When I enter username "tomsmith"
    And I enter password "SuperSecretPassword!"
    And I click the login button
    Then I should see "You logged into a secure area!"
    When I log out
    Then I should be on "/login"
