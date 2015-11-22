import _ from 'lodash';
import wrap from 'word-wrap';

const getOperationId = function (method_name, path_name) {
  if (path_name === '/' || path_name === '') return method_name;

  // clean url path for requests ending with '/'
  let clean_path = path_name;
  if (clean_path.indexOf('/', clean_path.length - 1) !== -1) {
    clean_path = clean_path.substring(0, clean_path.length - 1);
  }

  let segments = clean_path.split('/').slice(1);
  segments = _.transform(segments, (result, segment) => {
    if (segment[0] === '{' && segment[segment.length - 1] === '}') {
      segment = `by-${_.capitalize(segment.substring(1, segment.length - 1))}}`;
    }
    result.push(segment);
  });

  return _.camelCase(`${method_name.toLowerCase()}-${segments.join('-')}`);
};

export default function getViewForSwagger2 (swagger) {
  const authorized_methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'COPY', 'HEAD', 'OPTIONS', 'LINK', 'UNLIK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND'];

  _.each(swagger.paths, (path, path_name) => {
    path.endpointName = path_name.split('/')[1];
    _.each(path, (method, method_name) => {
      if (authorized_methods.indexOf(method_name.toUpperCase()) === -1) return;

      method['operationId'] = method['operationId'] || getOperationId(method_name, path_name);
      method['descriptionLines'] = wrap(method['description'], { width: 60, indent: '' }).split(/\n/);
      _.each(method.parameters, (param, param_name) => {
        if (param.$ref) {
          method.parameters.push(swagger.parameters[param.$ref]);
        }
        if (_.result(param, 'schema.$ref')) {
          const definition = param.schema.$ref.substring('#/definitions/'.length);
          if (definition) {
            param = _.assign(param, swagger.definitions[definition]);
          }
        }
      });

      _.each(method.responses, (response, response_code) => {
        if (_.result(response, 'schema.$ref') && swagger.definitions) {
          const value = swagger.definitions[response.schema.$ref] || {};
          if (_.result(value, 'properties.message')) {
            value.properties.message.description = _.result(value, 'properties.message.description', method.responses[response_code].description);
          }
          method.responses[response_code].schema = value;
        }
      });
    });
  });

  swagger.endpoints = _.unique(_.pluck(swagger.paths, 'endpointName'));

  return swagger;
}