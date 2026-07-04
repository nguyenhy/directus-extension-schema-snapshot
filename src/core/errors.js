// Typed error classes, one per failure category thrown across core/.
// Message text mirrors what plain Error used to throw — non-breaking for
// any consumer matching on err.message; adds err instanceof X for library
// consumers who want typed catch instead of string-matching.

class SchemaSnapshotError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class UnknownSchemaTypeError extends SchemaSnapshotError {}
class UnknownStoreTypeError extends SchemaSnapshotError {}
class UnknownFileFormatError extends SchemaSnapshotError {}
class UnknownEntityKindError extends SchemaSnapshotError {}
class UnknownExtractModeError extends SchemaSnapshotError {}
class InvalidSubdirFormatError extends SchemaSnapshotError {}
class FileNotFoundError extends SchemaSnapshotError {}
class InvalidJSONError extends SchemaSnapshotError {}
class EventNotFoundError extends SchemaSnapshotError {}
class AmbiguousRefError extends SchemaSnapshotError {}
class SourceNotFoundError extends SchemaSnapshotError {}
class NoVersionsError extends SchemaSnapshotError {}
class UnsupportedComboError extends SchemaSnapshotError {}
class SyncStateError extends SchemaSnapshotError {}

module.exports = {
  SchemaSnapshotError,
  UnknownSchemaTypeError,
  UnknownStoreTypeError,
  UnknownFileFormatError,
  UnknownEntityKindError,
  UnknownExtractModeError,
  InvalidSubdirFormatError,
  FileNotFoundError,
  InvalidJSONError,
  EventNotFoundError,
  AmbiguousRefError,
  SourceNotFoundError,
  NoVersionsError,
  UnsupportedComboError,
  SyncStateError,
};
