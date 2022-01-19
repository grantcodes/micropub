// Load node version of FormData if needed
import { FormData as NodeFormData } from 'formdata-polyfill/esm.min.js';

const FormData = typeof window !== 'undefined' ? window.FormData : NodeFormData;

function objectToFormData(
  object: any,
  formData: FormData = new FormData(),
  name: string | null = null,
): FormData {
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
}

export { objectToFormData };
