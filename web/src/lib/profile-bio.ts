export const BIO_MAX_LENGTH = 500;

// Standard Schema validation is also used by Better Auth on the server.
export const bioSchema = {
    "~standard": {
        version: 1 as const,
        vendor: "thriftwalk",
        validate(value: unknown) {
            if (typeof value !== "string" || value.length > BIO_MAX_LENGTH) {
                return {
                    issues: [
                        {
                            message: `Bio must be text of at most ${BIO_MAX_LENGTH} characters.`,
                        },
                    ],
                };
            }
            return { value: value.trim() };
        },
    },
};
