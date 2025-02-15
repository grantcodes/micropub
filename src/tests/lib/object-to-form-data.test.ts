import { it, describe } from "node:test";
import assert from "node:assert/strict";
import { FormData } from "formdata-polyfill/esm.min.js";
import { objectToFormData } from "../../lib/object-to-form-data.js";

/* eslint-disable @typescript-eslint/no-floating-promises */

describe("objectToFormData", () => {
	it("Basic form data", () => {
		const params = {
			array: ["foo", "bar"],
			number: 202,
			longString: "This is a long string :)",
		};
		const res = objectToFormData(params);
		assert.ok(res instanceof FormData);
		assert.equal(res.get("longString"), params.longString);
		assert.equal(res.get("number"), params.number.toString());
		assert.deepEqual(res.getAll("array[]"), params.array);
	});

	it("Add to existing form data", () => {
		const existing = new FormData();
		existing.append("existing", "exists");
		const params = {
			array: ["foo", "bar"],
			number: 202,
			longString: "This is a long string :)",
		};
		const res = objectToFormData(params, existing);
		assert.ok(res instanceof FormData);
		assert.equal(res.get("longString"), params.longString);
		assert.equal(res.get("number"), params.number.toString());
		assert.deepEqual(res.getAll("array[]"), params.array);
		assert.equal(res.get("existing"), "exists");
	});
});
