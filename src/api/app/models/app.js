// https://robbg.io/blog/2017-03-31-async-await-and-node-fs/
// http://2ality.com/2017/05/util-promisify.html
const fs = require('fs');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const cucumber = require('cucumber');

const model = require('./');


class App {
  constructor(options) {
    const { log, slave, cucumber: cucumberConfig, results, publisher, runType } = options;

    this.log = log;
    this.slave = slave;
    this.cucumber = cucumberConfig;
    this.results = results;
    this.publisher = publisher;
    this.runType = runType;
    this.slavesDeployed = false;
  }

  async runJob(testJob) {
    this.log.info(`${this.slavesDeployed ? 'slaves already deployed' : 'running testJob'}`, { tags: ['app'] });
    if (this.slavesDeployed) return 'Request ignored. Slaves already deployed.';
    const testRoutes = testJob.included.filter(resourceObject => resourceObject.type === 'route');
    const testSessions = testJob.included.filter(resourceObject => resourceObject.type === 'testSession');


    const sessionsProps = testSessions.map(sesh => ({
      testRoutes,
      protocol: testJob.data.attributes.sutProtocol,
      ip: testJob.data.attributes.sutIp,
      port: testJob.data.attributes.sutPort,
      browser: testJob.data.attributes.browser,
      loggedInIndicator: testJob.data.attributes.loggedInIndicator,
      context: { name: 'NodeGoat_Context' },
      authentication: testJob.data.attributes.sutAuthentication,
      reportFormats: testJob.data.attributes.reportFormats,
      testSession: sesh // The data array contains the relationshops to the testSessions
    }));

    if (this.runType === 'sequential') await model[this.runType]({ model: this, sessionsProps });
    else model[this.runType]({ model: this, sessionsProps });

    return 'App tests are now running.'; // This is propagated per session in the CLI model.
  }


  async testPlan(testJob) { // eslint-disable-line no-unused-vars
    const cucumberArgs = this.createCucumberArgs();
    const cucumberCliInstance = new cucumber.Cli({
      argv: ['node', ...cucumberArgs],
      cwd: process.cwd(),
      stdout: process.stdout
    });
    const activeTestCases = await this.getActiveTestCases(cucumberCliInstance);
    const testPlan = await this.testPlanText(activeTestCases);
    return testPlan;
  }


  createCucumberArgs(sutProps) {
    // sut.validateProperties(sutProperties);

    const slaveProperties = {
      protocol: this.slave.protocol,
      ip: this.slave.ip,
      port: this.slave.port,
      apiKey: this.slave.apiKey,
      apiFeedbackSpeed: this.slave.apiFeedbackSpeed,
      reportDir: this.slave.report.dir,
      spider: this.slave.spider
    };

    // zap.validateProperties(slaveProperties);

    const cucumberParameters = {
      slaveProperties,
      sutProperties: sutProps || {},
      cucumber: { timeOut: this.cucumber.timeOut }
    };

    const parameters = JSON.stringify(cucumberParameters);

    const cucumberArgs = [
      this.cucumber.binary,
      this.cucumber.features,
      '--require',
      this.cucumber.steps,
      /* '--exit', */
      `--format=json:${this.results.uri}`,
      '--tags',
      this.cucumber.tagExpression,
      '--world-parameters',
      parameters
    ];


    return cucumberArgs;
  }

  // eslint-disable-next-line class-methods-use-this
  async getActiveTestCases(cucumberCli) {
    // Files to work the below out where in:
    // https://github.com/cucumber/cucumber-js/blob/master/src/cli/index.js
    // https://github.com/cucumber/cucumber-js/blob/master/src/cli/helpers.js#L20
    // https://github.com/cucumber/cucumber-js/blob/master/src/cli/configuration_builder.js
    const configuration = await cucumberCli.getConfiguration();
    const activeTestCases = await cucumber.getTestCasesFromFilesystem({
      cwd: process.cwd(),
      eventBroadcaster: (() => new (require('events'))())(), // eslint-disable-line global-require
      featureDefaultLanguage: configuration.featureDefaultLanguage,
      featurePaths: configuration.featurePaths,
      order: configuration.order,
      pickleFilter: (() => new (require('cucumber/lib/pickle_filter')).default(configuration.pickleFilterOptions))() // eslint-disable-line global-require, new-cap
    });
    return activeTestCases;
  }

  // eslint-disable-next-line class-methods-use-this
  async testPlanText(activeTestCases) {
    const activeTestFileUris = activeTestCases
      .map(currentValue => currentValue.uri)
      .filter((currentValue, currentElementIndex, urisOfActiveTestCases) => urisOfActiveTestCases.indexOf(currentValue) === currentElementIndex);
    return (await Promise.all(activeTestFileUris
      .map(featureFileUri => readFileAsync(`${process.cwd()}/${featureFileUri}`, { encoding: 'utf8' }))))
      .reduce((accumulatedFeatures, feature) => accumulatedFeatures.concat(...['\n\n', feature]));
  }


  async testResult() {
    let result;

    try {
      result = await readFileAsync(this.results.uri, { encoding: 'utf8' });
    } catch (err) {
      this.log.error(`Could not read test results file, the error was: ${err}.`, { tags: ['app', 'testResult()'] });
    }

    return result;
  }
}


module.exports = App;
