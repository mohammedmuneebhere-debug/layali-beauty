declare module 'sanitize-html' {
  export interface SanitizeAttributes {
    [name: string]: string;
  }

  export interface SanitizeTag {
    tagName: string;
    attribs: SanitizeAttributes;
  }

  export interface SanitizeOptions {
    allowedTags?: string[] | false;
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowProtocolRelative?: boolean;
    disallowedTagsMode?: 'discard' | 'completelyDiscard' | 'escape' | 'recursiveEscape';
    nonTextTags?: string[];
    transformTags?: Record<
      string,
      (tagName: string, attribs: SanitizeAttributes) => SanitizeTag
    >;
  }

  export default function sanitizeHtml(dirty: string, options?: SanitizeOptions): string;
}
