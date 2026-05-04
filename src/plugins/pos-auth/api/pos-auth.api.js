import { gql } from 'graphql-tag';

const posAuthApiExtensions = gql`
    type PosAuthResult {
        token: String!
        userId: ID!
        username: String!
        role: String!
        displayName: String!
    }

    type PosUser implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        username: String!
        role: String!
        displayName: String!
        active: Boolean!
    }

    input CreatePosUserInput {
        username: String!
        password: String!
        role: String!
        displayName: String
    }

    input UpdatePosUserInput {
        displayName: String
        password: String
        active: Boolean
    }

    extend type Query {
        posUsers: [PosUser!]!
        posValidateToken(token: String!): PosAuthResult
    }

    extend type Mutation {
        posLogin(username: String!, password: String!, loginRole: String!): PosAuthResult!
        posCreateUser(input: CreatePosUserInput!): PosUser!
        posUpdateUser(id: ID!, input: UpdatePosUserInput!): PosUser!
        posDeleteUser(id: ID!): Boolean!
    }
`;

export { posAuthApiExtensions };
