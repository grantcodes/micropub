function objectToFormData (
  object: any,
  formData: FormData = new FormData(),
  name: string | null = null
): FormData {
  for (let key in object) {
    const data = object[key]
    if (name !== null && name !== '') {
      key = name + '[' + key + ']'
    }
    if (Array.isArray(data)) {
      for (const arrayItem of data) {
        const arrayData: any = {}
        arrayData[key + '[]'] = arrayItem
        formData = objectToFormData(arrayData, formData)
      }
    } else {
      formData.append(key, data)
    }
  }
  return formData
}

export { objectToFormData }
