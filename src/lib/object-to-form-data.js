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
      formData = objectToFormData(data, formData, key);
    } else {
      formData.append(key, data);
    }
  });
  return formData;
}
