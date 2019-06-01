var server = "https://e7921f84.ngrok.io";
var auth = null;

function getAuthType() {
  return { type: 'USER_PASS' };
}

function isAuthValid(request) {
  var userProperties = PropertiesService.getUserProperties();
  var username = userProperties.getProperty('dscc.username');

  if (username == "") {
    return false;
  }

  try {
    sendServerRequest("/builds?since=2019-05-30") // TODO better validation endpoint
  } catch (e) {
    Logger.log(e);
    return false;
  }

  return true;
}

function getCredentialsAuthorizationHeader() {
  var userProperties = PropertiesService.getUserProperties();
  var username = userProperties.getProperty('dscc.username');
  var password = userProperties.getProperty('dscc.password');

  return "Basic " + Utilities.base64Encode(username + ":" + password);
}

function setCredentials(request) {
  var username = request.userPass.username;
  var password = request.userPass.password;

  var userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('dscc.username', username);
  userProperties.setProperty('dscc.password', password);

  return {
    errorCode: 'NONE'
  };
}

function isAdminUser() {
  return true;
}

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  if (server == "") {
    config.newInfo()
      .setId('info0')
      .setText('Enter your Concourse Data Connector Server connection details.');

    config.newTextInput()
      .setId('server')
      .setName('Concourse Data Connector Server');
  } else {
    config.newInfo()
      .setId("info0")
      .setText("The default Concourse Data Connector Server will be used.");
  }

  config.setDateRangeRequired(true);

  return config.build();
}

function getFields(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;

  fields.newDimension()
    .setId('teamName')
    .setName('Team')
    .setDescription('Team Name')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('pipelineName')
    .setName('Pipeline')
    .setDescription('Pipeline Name')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('jobName')
    .setName('Job')
    .setDescription('Job Name')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('startTime')
    .setName('Start Time')
    .setDescription('Time when the build started')
    .setType(types.YEAR_MONTH_DAY);

  fields.newDimension()
    .setId('endTime')
    .setName('End Time')
    .setDescription('Time when the build completed')
    .setType(types.YEAR_MONTH_DAY);

  fields.newDimension()
    .setId('url')
    .setName('URL')
    .setDescription('URL to view the build')
    .setType(types.URL);

  fields.newDimension()
    .setId('status')
    .setName('Status')
    .setDescription('Status of the build (e.g. succeeded, failed)')
    .setType(types.TEXT);

  fields.newMetric()
    .setId('buildID')
    .setName('Build')
    .setDescription('Global build identifier')
    .setType(types.TEXT)
    .setAggregation(aggregations.COUNT);

  fields.newMetric()
    .setId('buildName')
    .setName('Build Name')
    .setDescription('Job build identifier')
    .setType(types.TEXT)
    .setAggregation(aggregations.COUNT);

  fields.newMetric()
    .setId('duration')
    .setName('Duration')
    .setDescription('Duration of the job from start to end')
    .setType(types.DURATION)
    .setAggregation(aggregations.SUM);

  return fields;
}

function getSchema(request) {
  var fields = getFields(request).build();
  return { schema: fields };
}

function getData(request) {
  Logger.log(JSON.stringify(request));

  var parsedResponse = sendServerRequest([
    '/builds?',
    '&since=' + request.dateRange.startDate,
    '&until=' + request.dateRange.endDate
  ].join(''));

  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var requestedFields = getFields().forIds(requestedFieldIds);

  var result = {
    schema: requestedFields.build(),
    rows: responseToRows(requestedFields, parsedResponse)
  };

  return result;
}

function sendServerRequest(uri) {
  var response = UrlFetchApp.fetch(
    server + uri,
    {
      headers: {
        "Authorization": getCredentialsAuthorizationHeader()
      }
    }
  );

  return JSON.parse(response);
}

function responseToRows(requestedFields, response) {
  return response.map(function(entry) {
    var row = [];
    requestedFields.asArray().forEach(function (field) {
      switch (field.getId()) {
        case 'teamName':
          return row.push(entry.team_name);
        case 'pipelineName':
          return row.push(entry.pipeline_name);
        case 'jobName':
          return row.push(entry.job_name);
        case 'buildID':
          return row.push(entry.id + "");
        case 'buildName':
          return row.push(entry.name);
        case 'startTime':
          // TODO YYYYMMDDHH + mm column?
          return row.push(responseTimestamp(entry.start_time));
        case 'endTime':
          return row.push(responseTimestamp(entry.end_time));
        case 'duration':
          // TODO unfinished builds?
          return row.push((entry.end_time - entry.start_time) + "");
        default:
          return row.push(entry[field.getId()]);
      }
    });
    return { values: row };
  });
}

function responseTimestamp(u) {
  if (u == "") {
    return "";
  }

  var d = new Date(u*1000);
  var dm = d.getMonth() + 1;
  var dd = d.getDate();

  return [d.getFullYear(), (dm < 10) ? "0" : "", dm, (dd < 10) ? "0" : "", dd].join('');
}
