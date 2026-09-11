export const PRODUCT_CARD_FRAGMENT = `#graphql
  fragment ProductCard on Product {
    id
    handle
    title
    description
    descriptionHtml
    availableForSale
    productType
    tags
    vendor
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 12) {
      nodes {
        url
        altText
        width
        height
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 50) {
      nodes {
        id
        title
        availableForSale
        quantityAvailable
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
        selectedOptions {
          name
          value
        }
        image {
          url
          altText
          width
          height
        }
      }
    }
    collections(first: 10) {
      nodes {
        id
        handle
        title
      }
    }
  }
`;

export const PRODUCTS_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...ProductCard
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductCard
    }
  }
`;

export const PRODUCT_BY_ID_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query ProductById($id: ID!) {
    product(id: $id) {
      ...ProductCard
    }
  }
`;

export const PRODUCTS_BY_IDS_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query ProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        ...ProductCard
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query CollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(first: $first) {
        nodes {
          ...ProductCard
        }
      }
    }
  }
`;

export const CART_FRAGMENT = `#graphql
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              amount
              currencyCode
            }
            image {
              url
              altText
              width
              height
            }
            product {
              id
              handle
              title
              featuredImage {
                url
                altText
              }
            }
          }
        }
      }
    }
  }
`;

export const CART_CREATE = `#graphql
  ${CART_FRAGMENT}
  mutation CartCreate($lines: [CartLineInput!], $buyerIdentity: CartBuyerIdentityInput) {
    cartCreate(input: { lines: $lines, buyerIdentity: $buyerIdentity }) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_QUERY = `#graphql
  ${CART_FRAGMENT}
  query Cart($id: ID!) {
    cart(id: $id) {
      ...CartFields
    }
  }
`;

export const CART_LINES_ADD = `#graphql
  ${CART_FRAGMENT}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_UPDATE = `#graphql
  ${CART_FRAGMENT}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_REMOVE = `#graphql
  ${CART_FRAGMENT}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;
