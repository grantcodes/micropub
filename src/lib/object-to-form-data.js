// Load node version of FormData if needed
if (!global.FormData) {
  global.FormData = require('form-data');
}

module.exports = function objectToFormData(
  object,
  formData = new FormData(),
  name = false,
) {
  for (let key in object) {
    if (object.hasOwnProperty(key)) {
      const data = object[key];
      if (name) {
        key = name + '[' + key + ']';
      }
      if (Array.isArray(data)) {
        for (const arrayItem of data) {
          const arrayData = {};
          arrayData[key + '[]'] = arrayItem;
          formData = objectToFormData(arrayData, formData);
        }
      } else {
        formData.append(key, data);
      }
    }
  }
  return formData;
};
