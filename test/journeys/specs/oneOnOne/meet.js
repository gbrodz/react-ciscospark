/* eslint-disable max-nested-callbacks */
import {assert} from 'chai';
import testUsers from '@ciscospark/test-helper-test-users';
import '@ciscospark/plugin-phone';
import {switchToMeet} from '../../lib/menu';
import {clearEventLog, getEventLog} from '../../lib/events';

describe(`Widget Space: One on One`, () => {
  const browserLocal = browser.select(`browserLocal`);
  const browserRemote = browser.select(`browserRemote`);
  let mccoy, spock;
  process.env.CISCOSPARK_SCOPE = [
    `webexsquare:get_conversation`,
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
      .url(`/?meet`)
      .execute(() => {
        localStorage.clear();
      });
  });

  before(`create spock`, () => testUsers.create({count: 1, config: {displayName: `Mr Spock`}})
    .then((users) => {
      [spock] = users;
    }));

  before(`create mccoy`, () => testUsers.create({count: 1, config: {displayName: `Bones Mccoy`}})
    .then((users) => {
      [mccoy] = users;
    }));

  before(`pause to let test users establish`, () => browser.pause(7500));

  before(`open local widget spock`, () => {
    browserLocal.execute((localAccessToken, localToUserEmail) => {
      const options = {
        accessToken: localAccessToken,
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push(eventName);
        },
        toPersonEmail: localToUserEmail,
        initialActivity: `message`
      };
      window.openSpaceWidget(options);
    }, spock.token.access_token, mccoy.email);
    browserLocal.waitForVisible(`[placeholder="Send a message to ${mccoy.displayName}"]`, 30000);
  });

  before(`open remote widget mccoy`, () => {
    browserRemote.execute((localAccessToken, localToUserEmail) => {
      const options = {
        accessToken: localAccessToken,
        onEvent: (eventName) => {
          window.ciscoSparkEvents.push(eventName);
        },
        toPersonEmail: localToUserEmail,
        initialActivity: `message`
      };
      window.openSpaceWidget(options);
    }, mccoy.token.access_token, spock.email);
    browserRemote.waitForVisible(`[placeholder="Send a message to ${spock.displayName}"]`, 30000);
  });

  describe(`meet widget`, () => {
    const meetWidget = `.ciscospark-meet-wrapper`;
    const messageWidget = `.ciscospark-message-wrapper`;
    const callButton = `button[aria-label="Call"]`;
    const answerButton = `button[aria-label="Answer"]`;
    const declineButton = `button[aria-label="Decline"]`;
    const hangupButton = `button[aria-label="Hangup"]`;
    const callControls = `.call-controls`;
    const remoteVideo = `.remote-video video`;

    describe(`pre call experience`, () => {
      before(`switch to meet widget`, () => {
        switchToMeet(browserLocal);
      });

      it(`has a call button`, () => {
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
      });
    });

    describe(`during call experience`, () => {

      beforeEach(`switch to meet widget`, () => {
        // widget switches to message after hangup
        switchToMeet(browserLocal);
        switchToMeet(browserRemote);
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
        browserRemote.element(meetWidget).element(callButton).waitForVisible();
      });

      it(`can hangup before answer`, () => {
        browserLocal.element(meetWidget).element(callButton).click();
        // wait for call to establish
        browserRemote.waitForVisible(answerButton);
        // Call controls currently has a hover state
        browserLocal.moveToObject(meetWidget);
        browserLocal.waitForVisible(callControls);
        browserLocal.moveToObject(hangupButton);
        browserLocal.element(meetWidget).element(hangupButton).click();
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
        browserRemote.element(meetWidget).element(callButton).waitForVisible();
      });

      it(`can decline an incoming call`, () => {
        browserRemote.element(meetWidget).element(callButton).click();
        browserLocal.waitForVisible(declineButton);
        browserLocal.element(meetWidget).element(declineButton).click();
        browserLocal.element(meetWidget).element(callButton).waitForVisible();
        browserRemote.element(meetWidget).element(callButton).waitForVisible();
        // Pausing to let locus session flush
        browserLocal.pause(10000);
      });

      it(`can hangup in call`, () => {
        clearEventLog(browserLocal);
        browserLocal.element(meetWidget).element(callButton).click();
        browserRemote.waitForVisible(answerButton);
        browserRemote.element(meetWidget).element(answerButton).click();
        browserRemote.waitForVisible(remoteVideo);
        // Let call elapse 5 seconds before hanging up
        browserLocal.pause(5000);
        browserLocal.moveToObject(meetWidget);
        browserLocal.waitForVisible(callControls);
        browserLocal.moveToObject(hangupButton);
        browserLocal.element(meetWidget).element(hangupButton).click();
        // Should switch back to message widget after hangup
        browserLocal.waitForVisible(messageWidget);
        const events = getEventLog(browserLocal);
        assert.include(events, `calls:created`, `has a calls created event`);
        assert.include(events, `calls:connected`, `has a calls connected event`);
        assert.include(events, `calls:disconnected`, `has a calls disconnected event`);
      });
    });
  });
});
