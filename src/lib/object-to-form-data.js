// const FormData = require('form-data');

export default function objectToFormData(
  object,
  formData = new FormData(),
  name = false,
) {
  Object.keys(object).forEach(key => {
    const data = object[key];
    if (name) {
      key = name + '[' + key + ']';
    }
    if (Array.isArray(data)) {
      data.forEach(arrayItem => {
        const arrayData = {};
        arrayData[key + '[]'] = arrayItem;
        formData = objectToFormData(arrayData, formData);
      });
    } else if (data !== null && typeof data === 'object') {
      formData = objectToFormData(data, formData, key);
    } else {
      formData.append(key, data);
    }
  });
  return formData;
}
