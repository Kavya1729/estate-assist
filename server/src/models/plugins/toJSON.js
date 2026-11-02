/**
 * Serialises documents as API-friendly JSON: `id` instead of `_id`, no `__v`,
 * and never any field marked `private: true` in the schema.
 */
export function toJSON(schema) {
  const privatePaths = Object.entries(schema.paths)
    .filter(([, type]) => type.options?.private)
    .map(([path]) => path);

  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      if (ret._id != null) ret.id = ret._id.toString();
      delete ret._id;
      for (const path of privatePaths) delete ret[path];
      return ret;
    },
  });
}
