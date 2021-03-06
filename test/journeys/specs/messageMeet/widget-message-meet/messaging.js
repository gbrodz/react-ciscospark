/* eslint-disable max-nested-callbacks */

import {assert} from 'chai';

import testUsers from '@ciscospark/test-helper-test-users';
import '@ciscospark/plugin-conversation';
import {switchToMessage} from '../../../lib/menu';
import {clearEventLog, getEventLog} from '../../../lib/events';

describe(`Widget Message Meet`, () => {
  const browserLocal = browser.select(`browserLocal`);
  const browserRemote = browser.select(`browserRemote`);
  let mccoy, spock;
  process.env.CISCOSPARK_SCOPE = [
    `webexsquare:get_conversation`,
    `Identity:SCIM`,
    `spark:people_read`,
    `spark:rooms_read`,
    `spark:rooms_write`,
    `spark:memberships_read`,
    `spark:memberships_write`,
    `spark:messages_read`,
    `spark:messages_write`,
    `spark:teams_read`,
    `spark:teams_write`,
    `spark:team_memberships_read`,
    `spark:team_memberships_write`,
    `spark:kms`
  ].join(` `);

  before(`load browsers`, () => {
    browser
      .url(`/message-meet.html`)
      .execute(() => {
        localStorage.clear();
      });
  });

  before(`create spock`, () => testUsers.create({count: 1, displayName: `spock`})
    .then((users) => {
      [spock] = users;
    }));

  before(`create mccoy`, () => testUsers.create({count: 1, displayName: `mccoy`})
    .then((users) => {
      [mccoy] = users;
    }));

  before(`pause to let test users establish`, () => browser.pause(5000));

  before(`inject token`, () => {
    browserLocal.execute((localAccessToken, localToUserEmail) => {
      const options = {
        accessToken: localAccessToken,
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push(eventName);
        },
        toPersonEmail: localToUserEmail,
        initialActivity: `message`
      };
      window.openWidgetMessageMeet(options);
    }, spock.token.access_token, mccoy.email);
    browserLocal.waitForVisible(`[placeholder="Send a message to ${mccoy.displayName}"]`);
  });

  describe(`meet widget`, () => {
    before(`open remote widget`, () => {
      browserRemote.execute((localAccessToken, localToUserEmail) => {
        const options = {
          accessToken: localAccessToken,
          onEvent: (eventName) => {
            window.ciscoSparkEvents.push(eventName);
          },
          toPersonEmail: localToUserEmail,
          initialActivity: `message`
        };
        window.openWidgetMessageMeet(options);
      }, mccoy.token.access_token, spock.email);
      browserRemote.waitForVisible(`[placeholder="Send a message to ${spock.displayName}"]`);
    });

    beforeEach(`widget switches to message`, () => {
      switchToMessage(browserLocal);
      switchToMessage(browserRemote);
    });

    it(`sends and receives messages`, () => {
      // Increase wait timeout for message delivery
      browser.timeouts(`implicit`, 10000);
      browserLocal.waitForVisible(`[placeholder="Send a message to ${mccoy.displayName}"]`);
      assert.match(browserLocal.getText(`.ciscospark-system-message`), /You created this conversation/);
      browserRemote.waitForVisible(`[placeholder="Send a message to ${spock.displayName}"]`);
      // Remote is now ready, send a message to it
      browserLocal.setValue(`[placeholder="Send a message to ${mccoy.displayName}"]`, `Oh, I am sorry, Doctor. Were we having a good time?\n`);
      browserRemote.waitUntil(() => browserRemote.getText(`.ciscospark-activity-item-container:last-child .ciscospark-activity-text`) === `Oh, I am sorry, Doctor. Were we having a good time?`);
      // Send a message back
      clearEventLog(browserLocal);
      browserRemote.setValue(`[placeholder="Send a message to ${spock.displayName}"]`, `God, I liked him better before he died.\n`);
      browserLocal.waitUntil(() => browserLocal.getText(`.ciscospark-activity-item-container:last-child .ciscospark-activity-text`) === `God, I liked him better before he died.`);
      const events = getEventLog(browserLocal);
      assert.include(events, `messages:created`, `has a message created event`);
      assert.include(events, `messages:unread`, `has an unread message event`);
    });

    it(`sends and deletes message`);

    it(`sends message with markdown`);

    it(`sends message with pdf attachment`);

    it(`sends message with gif attachment`);

    it(`sends message with jpg attachment`);

    it(`sends message with png attachment`);

    it(`sends and flags message`);

  });
});
