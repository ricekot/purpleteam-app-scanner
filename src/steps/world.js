const config = require(`${process.cwd()}/config/config`); // eslint-disable-line import/no-dynamic-require
const log = require('purpleteam-logger').init(config.get('logger'));
// features/support/world.js
const cucumber = require('cucumber');

const { setWorldConstructor, setDefaultTimeout } = cucumber;

const sut = require(`${process.cwd()}/src/api/app/do/sut`); // eslint-disable-line import/no-dynamic-require
const zap = require(`${process.cwd()}/src/slaves/zap`); // eslint-disable-line import/no-dynamic-require


class CustomWorld {
  constructor({ attach, parameters }) {
    const { sutProperties } = parameters;

    this.log = log;
    this.log.notice(`Constructing the cucumber world for session with id "${parameters.sutProperties.testSession.id}".\n`, { tags: ['world'] });

    this.variable = 0;
    this.attach = attach;

    setDefaultTimeout(parameters.cucumber.timeOut);

    this.sut = sut;
    this.sut.init({ log, sutProperties });
    this.zap = zap;
    this.zap.init({ log, slaveProperties: { ...parameters.slaveProperties, sutBaseUrl: this.sut.baseUrl() } });
  }


  async initialiseBrowser() {
    await this.sut.initialiseBrowser(this.zap.getPropertiesForBrowser());
  }


  // simple_math related stuff.

  setTo(number) {
    this.variable = number;
  }

  incrementBy(number) {
    this.variable += number;
  }
}

setWorldConstructor(CustomWorld);
