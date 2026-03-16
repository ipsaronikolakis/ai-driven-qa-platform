Feature: Login functionality

  Scenario: User logs in successfully
    Given I am on the login page
    When I enter username "tomsmith"
    And I enter password "SuperSecretPassword!"
    And I click the login button
    Then I should see "You logged into a secure area!"

  Scenario: User logs in unsuccessfully with wrong password
    Given I am on the login page
    When I enter username "tomsmith"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see "Your password is invalid!"

  Scenario: User logs in with invalid username
    Given I am on the login page
    When I enter username "invaliduser"
    And I enter password "SuperSecretPassword!"
    And I click the login button
    Then I should see "Your username is invalid!"

  Scenario: User is redirected to secure area after login
    Given I am on the login page
    When I enter username "tomsmith"
    And I enter password "SuperSecretPassword!"
    And I click the login button
    Then I should be on "/secure"
