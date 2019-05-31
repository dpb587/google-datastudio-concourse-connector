function getAuthType() {
  var response = { type: 'NONE' };
  return response;
}

function isAdminUser() {
  return true;
}

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config.newInfo()
    .setId('info0')
    .setText('Enter your Concourse connection details.');

  config.newTextInput()
    .setId('server')
    .setName('Concourse Data Connector Server');

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
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var requestedFields = getFields().forIds(requestedFieldIds);

  // Fetch and parse data from API
  var url = [
    request.configParams.server,
    '/builds',
    '?',
    '&since=' + request.dateRange.startDate,
    '&until=' + request.dateRange.endDate
  ];

  var response = UrlFetchApp.fetch(url.join(''));
  var parsedResponse = JSON.parse(response);
  var rows = responseToRows(requestedFields, parsedResponse);

  var result = {
    schema: requestedFields.build(),
    rows: rows
  };

  return result;
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
