const cucumber = require('cucumber');

const config = require('config/config');
const log = require('purpleteam-logger').init(config.get('logger'));
const publisher = require('src/publishers/messagePublisher').init({ log, redis: config.get('redis.clientCreationOptions') });

// Following code taken from https://github.com/cucumber/cucumber-js/blob/cfc9b4a1db5b97d95350ce41144ae69084096adc/src/cli/run.js
//   then modified:
//     Patched stdout
//     Removed verror for now

function exitWithError(error) {
  console.error(/* VError.fullStack(error) */error); // eslint-disable-line no-console
  process.exit(1);
}

let testSessionId = 'To be assigned';

const cucumberCliStdout = {
  publisher,
  write(...writeParams) {
    const [str] = writeParams;
    publisher.pubLog({ testSessionId, logLevel: 'notice', textData: str, tagObj: { tags: ['runCuc', 'cucumberCLI-stdout-write'] } });
  }
};

exports.default = async function run() {
  const cwd = process.cwd();
  const worldParametersV = 9;
  const worldParameters = JSON.parse(process.argv[worldParametersV]);
  testSessionId = worldParameters.sutProperties.testSession.id;
  // Uncomment the following to check the world parameters.
  /*
  publisher.pubLog({
    testSessionId,
    logLevel: 'notice',
    textData: `The world parameters for this test session are:\n${JSON.stringify(worldParameters, null, 2)} `,
    tagObj: { tags: ['runCuc', 'cucumberCLI-stdout-write'] }
  });
  */

  const cli = new cucumber.Cli({
    argv: process.argv,
    cwd,
    stdout: cucumberCliStdout
  });

  let result;
  try {
    result = await cli.run();
  } catch (error) {
    exitWithError(error);
  }

  const exitCode = result.success ? 0 : 1;
  if (result.shouldExitImmediately) {
    process.exit(exitCode);
  } else {
    process.exitCode = exitCode;
  }
};