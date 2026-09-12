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

/**
 * Lighter catalog/list shape: fewer images/variants, CDN-resized featured image.
 * Used by PRODUCTS_QUERY + COLLECTION_PRODUCTS_QUERY (full catalog pagination).
 * PDP / by-id keep PRODUCT_CARD_FRAGMENT.
 */
export const PRODUCT_LIST_FRAGMENT = `#graphql
  fragment ProductListCard on Product {
    id
    handle
    title
    description
    availableForSale
    productType
    tags
    vendor
    featuredImage {
      url(transform: { maxWidth: 600 })
      altText
      width
      height
    }
    images(first: 3) {
      nodes {
        url(transform: { maxWidth: 600 })
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
    variants(first: 8) {
      nodes {
        id
        title
        availableForSale
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
      }
    }
    collections(first: 3) {
      nodes {
        id
        handle
        title
      }
    }
  }
`;

export const PRODUCTS_QUERY = `#graphql
  ${PRODUCT_LIST_FRAGMENT}
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...ProductListCard
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
  ${PRODUCT_LIST_FRAGMENT}
  query CollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...ProductListCard
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
    buyerIdentity {
      countryCode
    }
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
    }
    # Shopify SOT for discounts — money from totalAllocatedAmount (not hardcoded %).
    # Shipping is not on cart until Checkout; do not invent delivery fees here.
    discountApplications {
      totalAllocatedAmount {
        amount
        currencyCode
      }
      ... on CartAutomaticDiscountApplication {
        title
      }
      ... on CartCodeDiscountApplication {
        code
      }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        discountAllocations(lineLevelOnly: false) {
          discountedAmount {
            amount
            currencyCode
          }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              amount
              currencyCode
            }
            compareAtPrice {
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
      warnings {
        code
        message
        target
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
      warnings {
        code
        message
        target
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
      warnings {
        code
        message
        target
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
      warnings {
        code
        message
        target
      }
    }
  }
`;

export const CART_BUYER_IDENTITY_UPDATE = `#graphql
  ${CART_FRAGMENT}
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
      warnings {
        code
        message
        target
      }
    }
  }
`;
