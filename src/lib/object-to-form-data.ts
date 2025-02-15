type ObjectToFormDataAppend = string | number | boolean | Blob | File;

export interface ObjectToFormDataData {
	[key: string]: ObjectToFormDataAppend | ObjectToFormDataAppend[];
}

function objectToFormData(
	object: ObjectToFormDataData,
	formData: FormData = new FormData(),
): FormData {
	let updatedFormData = formData;
	for (const key in object) {
		const data = object[key];
		if (Array.isArray(data)) {
			for (const arrayItem of data) {
				const arrayData: ObjectToFormDataData = {};
				arrayData[`${key}[]`] = arrayItem;
				updatedFormData = objectToFormData(arrayData, updatedFormData);
			}
		} else {
			// @ts-ignore - FormData.append automatically converts booleans and numbers to strings
			updatedFormData.append(key, data);
		}
	}
	return updatedFormData;
}

export { objectToFormData };
